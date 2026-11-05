import { describe, expect, it } from "vitest";
import { createPollClock } from "./usePollUntil";

describe("createPollClock", () => {
  it("starts counting at the first poll of a path, not when the page opened", () => {
    let now = 1_000;
    const clock = createPollClock(() => now);

    now += 60_000;
    expect(clock.elapsedMs()).toBe(0);

    clock.mark("/api/v1/join-requests/1");
    now += 1_500;
    clock.mark("/api/v1/join-requests/1");

    expect(clock.elapsedMs()).toBe(1_500);
  });

  it("restarts when polling moves to another path", () => {
    let now = 0;
    const clock = createPollClock(() => now);

    clock.mark("/api/v1/join-requests/1");
    now += 40_000;
    clock.mark("/api/v1/join-requests/2");
    now += 1_000;

    expect(clock.elapsedMs()).toBe(1_000);
  });
});
