import { describe, expect, it } from "vitest";
import { skillUnitRoleLabel } from "../labels";

describe("skillUnitRoleLabel（Skill の内訳のラベル）", () => {
  it("基本リストだけ・特有リストだけ・両方", () => {
    expect(skillUnitRoleLabel(["base"])).toBe("基本技術");
    expect(skillUnitRoleLabel(["distinctive"])).toBe("特有技術");
    expect(skillUnitRoleLabel(["base", "distinctive"])).toBe("基本＋特有");
    expect(skillUnitRoleLabel(["distinctive", "base"])).toBe("基本＋特有");
  });

  it("どちらのリストにも入らない unit はエラー（採用 unit は必ずどちらかに入る）", () => {
    expect(() => skillUnitRoleLabel([])).toThrow();
  });
});
