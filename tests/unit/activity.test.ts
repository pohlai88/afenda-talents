import { describe, expect, it } from "vitest";
import { FEED_ACTIONS, activitySentence } from "@/lib/activity";

describe("activitySentence", () => {
  it("writes a sentence for every action the feed shows", () => {
    for (const action of FEED_ACTIONS) {
      const sentence = activitySentence({ action, actorName: "Jack", subjectName: "Amira" });
      expect(sentence).toBeTruthy();
      // No raw action code may leak into the feed.
      expect(sentence).not.toContain(action);
    }
  });

  it("drops actions the hiring feed does not show", () => {
    expect(
      activitySentence({ action: "admin.login", actorName: "Jack", subjectName: null }),
    ).toBeNull();
    expect(
      activitySentence({ action: "data.purged", actorName: "Jack", subjectName: null }),
    ).toBeNull();
    expect(
      activitySentence({ action: "user.password_changed", actorName: "Jack", subjectName: null }),
    ).toBeNull();
  });

  it("names a deleted candidate without exposing an identifier", () => {
    const sentence = activitySentence({
      action: "assessment.submitted",
      actorName: null,
      subjectName: null,
    })!;
    expect(sentence).toContain("record was deleted");
    expect(sentence).not.toMatch(/c[a-z0-9]{20,}/);
  });

  it("falls back gracefully when the actor is unknown", () => {
    const sentence = activitySentence({
      action: "export.downloaded",
      actorName: null,
      subjectName: null,
    })!;
    expect(sentence.startsWith("Someone")).toBe(true);
  });
});
