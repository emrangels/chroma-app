#!/usr/bin/env python3
"""Poll the EasyVisit booking API for new GP appointment slots and notify via ntfy.

Booking page this mirrors: https://web.easyvisit.com.au/booking/103/760
(Mawson Medical Centre, "Standard appt." appointment type)
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

LOCATION_ID = 103
APPT_TYPE_ID = 760
API_URL = (
    f"https://api.easyvisit.com.au/api/v1/Location/{LOCATION_ID}"
    f"/appointmenttypes/{APPT_TYPE_ID}/resources"
)
BOOKING_PAGE_URL = f"https://web.easyvisit.com.au/booking/{LOCATION_ID}/{APPT_TYPE_ID}"
NTFY_URL = "https://ntfy.sh/emma-gp-appt-x7f3k9"
USER_AGENT = "gp-appointment-checker/1.0 (polls every 5 min for personal use)"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(SCRIPT_DIR, "last_seen.json")


def fetch_slots():
    """Return {"<resourceId>|<dateTime>": {"doctor": str, "dateTime": str}} for every open slot."""
    req = urllib.request.Request(
        API_URL,
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    if payload.get("StatusCode") != 200 or not isinstance(payload.get("Data"), list):
        raise RuntimeError(f"unexpected response shape: {json.dumps(payload)[:300]}")

    slots = {}
    for doctor in payload["Data"]:
        name = doctor.get("name", "Unknown")
        for day in doctor.get("availableSlotDates") or []:
            for slot in day.get("slots") or []:
                key = f"{slot['resourceId']}|{slot['dateTime']}"
                slots[key] = {"doctor": name, "dateTime": slot["dateTime"]}
    return slots


def load_previous_slots():
    if not os.path.exists(STATE_FILE):
        return None  # signals "no baseline yet" (first-ever run)
    with open(STATE_FILE) as f:
        return json.load(f).get("slots", {})


def save_state(slots):
    with open(STATE_FILE, "w") as f:
        json.dump(
            {
                "checked_at": datetime.now(timezone.utc).isoformat(),
                "slot_count": len(slots),
                "slots": slots,
            },
            f,
            indent=2,
            sort_keys=True,
        )
        f.write("\n")


def format_slot_time(iso_dt):
    try:
        return datetime.fromisoformat(iso_dt).strftime("%a, %d %b %Y %I:%M %p")
    except ValueError:
        return iso_dt


def send_ntfy(message, title=None, priority=None, tags=None):
    headers = {"Content-Type": "text/plain; charset=utf-8"}
    if title:
        headers["Title"] = title
    if priority:
        headers["Priority"] = priority
    if tags:
        headers["Tags"] = tags
    req = urllib.request.Request(
        NTFY_URL, data=message.encode("utf-8"), headers=headers, method="POST"
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        resp.read()


def main():
    try:
        current_slots = fetch_slots()
    except Exception as e:  # noqa: BLE001 - want to catch and alert on anything
        error_msg = (
            f"GP appointment checker broke while fetching slots: "
            f"{type(e).__name__}: {e}"
        )
        print(error_msg, file=sys.stderr)
        try:
            send_ntfy(
                f"{error_msg}\nBooking page: {BOOKING_PAGE_URL}",
                title="GP checker broke",
                priority="high",
                tags="warning,skull",
            )
        except Exception as ntfy_err:  # noqa: BLE001
            print(f"Also failed to send ntfy error alert: {ntfy_err}", file=sys.stderr)
        sys.exit(1)

    previous_slots = load_previous_slots()

    if previous_slots is None:
        # First run ever: just record the baseline, don't notify for every
        # slot that already existed before we started watching.
        print(f"No previous state found. Seeding baseline with {len(current_slots)} slots.")
        save_state(current_slots)
        return

    new_keys = set(current_slots) - set(previous_slots)

    if new_keys:
        for key in sorted(new_keys, key=lambda k: current_slots[k]["dateTime"]):
            slot = current_slots[key]
            when = format_slot_time(slot["dateTime"])
            message = f"New GP appointment available: {when} with {slot['doctor']}"
            print(message)
            try:
                send_ntfy(
                    f"{message}\n{BOOKING_PAGE_URL}",
                    title="New GP appointment",
                    tags="calendar,+1",
                )
            except Exception as e:  # noqa: BLE001
                print(f"Failed to send ntfy notification: {e}", file=sys.stderr)
    else:
        print(f"No new slots. {len(current_slots)} total slots currently available.")

    save_state(current_slots)


if __name__ == "__main__":
    main()
