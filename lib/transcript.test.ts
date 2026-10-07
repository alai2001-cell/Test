import { test } from "node:test";
import assert from "node:assert/strict";
import { flattenContents, linkTimestamps, nearestAnchor, transcriptForModel, anchorId } from "./transcript";
import { addDays, dayOf, parseClock, formatTime } from "./time";

const tz = "America/New_York";

test("parseClock handles AM/PM", () => {
  assert.equal(parseClock("10:42 AM"), 10 * 60 + 42);
  assert.equal(parseClock("12:05 AM"), 5);
  assert.equal(parseClock("12:30 PM"), 12 * 60 + 30);
  assert.equal(parseClock("9:01pm"), 21 * 60 + 1);
  assert.equal(parseClock("nope"), null);
});

test("day helpers respect timezone", () => {
  assert.equal(dayOf("2026-10-07T03:30:00Z", tz), "2026-10-06");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(formatTime("2026-10-07T14:42:00Z", tz), "10:42 AM");
});

test("flattenContents produces speaker lines with local clock", () => {
  const lines = flattenContents(
    [
      { type: "heading1", content: "Standup", startTime: "2026-10-07T13:00:00Z" },
      {
        type: "heading2",
        content: "Roadmap",
        children: [
          { type: "blockquote", content: "Ship it Friday.", speakerName: "Albert", speakerIdentifier: "user", startTime: "2026-10-07T13:01:00Z" },
          { type: "blockquote", content: "OK.", speakerName: "Jeff", startTime: "2026-10-07T13:02:00Z" },
        ],
      },
    ],
    tz,
  );
  assert.equal(lines.length, 4);
  assert.equal(lines[2].speaker, "Albert (me)");
  assert.equal(lines[2].clock, "9:01 AM");
  const text = transcriptForModel(
    [{ id: "x", title: "Standup", startTime: "2026-10-07T13:00:00Z", endTime: "2026-10-07T13:15:00Z", lines }],
    tz,
  );
  assert.match(text, /\[9:01 AM\] Albert \(me\): Ship it Friday\./);
  assert.match(text, /=== 9:00 AM–9:15 AM · Standup ===/);
});

test("linkTimestamps maps to nearest earlier anchor", () => {
  assert.equal(nearestAnchor([540, 600, 700], 650), 600);
  assert.equal(nearestAnchor([540, 600], 100), 540);
  const md = "- **[10:42 AM]** Decided X\n- [already](#x) [9:00 AM]";
  const out = linkTimestamps(md, [540, 630]);
  assert.match(out, /\[10:42 AM\]\(#t-1030\)/);
  assert.match(out, /\[9:00 AM\]\(#t-0900\)/);
  assert.equal(anchorId(5), "t-0005");
});
