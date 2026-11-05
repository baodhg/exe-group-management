import type { OverviewRoom } from "../common/types";

export function missingMembersText(room: Pick<OverviewRoom, "missingMembers">, minGroupSize: number): string {
  return room.missingMembers > 0 ? `${room.missingMembers} người (tối thiểu ${minGroupSize})` : "—";
}

export function missingMajorsText(room: Pick<OverviewRoom, "missingMajorSeats" | "majors">): string {
  if (room.missingMajorSeats === 0) {
    return "—";
  }

  const short = room.majors.filter((major) => major.members < major.required).map((major) => `${major.majorCode} ${major.members}/${major.required}`);
  return short.length > 0 ? short.join(", ") : `${room.missingMajorSeats} chỗ cho ngành khác`;
}
