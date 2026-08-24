import CubieCube from "./CubieCube";
import CoordCube from "./CoordCube";
import Util from "./Util";

export type SolveMethod = "kociemba" | "cfop" | "layerfirst";

export interface SolveStep {
  exp: string;
  moveIndex: number;
  phase: number;
  phaseLabel: string;
}

export interface SolvePhaseInfo {
  index: number;
  label: string;
  startStep: number;
  endStep: number;
}

export interface SolveResult {
  method: SolveMethod;
  raw: string;
  steps: SolveStep[];
  phases: SolvePhaseInfo[];
  error?: string;
}

// 阶段标签：CFOP 4 阶段；层先法 7 阶段；kociemba 单阶段
const PHASE_LABELS: Record<SolveMethod, string[]> = {
  kociemba: ["求解"],
  cfop: ["Cross 底层十字", "F2L 前两层", "OLL 顶层朝向", "PLL 顶层排列"],
  layerfirst: [
    "1. 底层十字",
    "2. 底层角块",
    "3. 中层棱块",
    "4. 顶层十字",
    "5. 顶层角定向",
    "6. 顶层角位置",
    "7. 顶层棱位置",
  ],
};

export default class Solver {
  private static MAX_PRE_MOVES = 20;
  private static TRY_INVERSE = true;
  private static TRY_THREE_AXES = true;
  private static MIN_P1LENGTH_PRE = 7;
  private static MAX_DEPTH2 = 13;

  private valid1: number;
  private cc: CubieCube;
  private move: number[];
  private moveSol: number[] | null;
  private nodeUD: CoordCube[];
  private urfCubieCube: CubieCube[];
  private urfCoordCube: CoordCube[];
  private phase1Cubie: CubieCube[];
  private preMoveCubes: CubieCube[];
  private allowShorter: boolean;
  private preMoves: number[];
  private preMoveLen: number;
  private maxPreMoves: number;
  private sol: number;

  constructor() {
    CubieCube.Init();
    CoordCube.Init();

    this.move = [];
    this.moveSol = [];

    this.nodeUD = [];

    this.valid1 = 0;
    this.allowShorter = false;
    this.cc = new CubieCube();
    this.urfCubieCube = [];
    this.urfCoordCube = [];
    this.phase1Cubie = [];

    this.preMoveCubes = [];
    this.preMoves = [];
    this.preMoveLen = 0;
    this.maxPreMoves = 0;

    for (let i = 0; i < 21; i++) {
      this.nodeUD[i] = new CoordCube();
      this.phase1Cubie[i] = new CubieCube();
    }
    for (let i = 0; i < 6; i++) {
      this.urfCubieCube[i] = new CubieCube();
      this.urfCoordCube[i] = new CoordCube();
    }
    for (let i = 0; i < Solver.MAX_PRE_MOVES; i++) {
      this.preMoveCubes[i + 1] = new CubieCube();
    }
  }

  init(): void {
    CoordCube.Init();
  }

  solve(facelets: string): string {
    const valid = this.cc.deserialize(facelets);
    if (!valid) {
      return "error: invalid cube";
    }
    const verify = this.cc.verify();
    if (verify.length > 0) {
      return "error: " + verify;
    }
    this.sol = 22;
    this.moveSol = null;
    this.initSearch();
    const solution = this.search();
    return solution;
  }

  /**
   * 带阶段切分的求解：
   * - kociemba：直接返回单阶段解
   * - cfop / layerfirst：底层仍调用 kociemba 求解，再按状态进展把解序列切分为 CFOP 4 阶段或层先法 7 阶段
   *   这是「分阶段标注」实现，不是真正的公式库求解；保证总有解、可逐步播放。
   */
  solvePhased(facelets: string, method: SolveMethod): SolveResult {
    const labels = PHASE_LABELS[method];
    const makeError = (msg: string): SolveResult => ({
      method,
      raw: "",
      steps: [],
      phases: labels.map((label, index) => ({ index, label, startStep: 0, endStep: 0 })),
      error: msg,
    });

    const cc = new CubieCube();
    if (!cc.deserialize(facelets)) return makeError("error: invalid cube");
    const verify = cc.verify();
    if (verify.length > 0) return makeError("error: " + verify);

    if (method === "kociemba") {
      const raw = this.solve(facelets).trim();
      if (raw.startsWith("error")) return makeError(raw);
      const exps = raw.split(/\s+/).filter(Boolean);
      const steps: SolveStep[] = exps.map((exp, i) => ({
        exp,
        moveIndex: i,
        phase: 0,
        phaseLabel: labels[0],
      }));
      return {
        method,
        raw: exps.join(" "),
        steps,
        phases: [{ index: 0, label: labels[0], startStep: 0, endStep: steps.length }],
      };
    }

    // CFOP / 层先法：先用 kociemba 求解，再按状态切分阶段
    const raw = this.solve(facelets).trim();
    if (raw.startsWith("error")) return makeError(raw);
    const exps = raw.split(/\s+/).filter(Boolean);

    // 把字符串动作映射回 move 索引，便于在 CubieCube 上模拟
    const sim = new CubieCube();
    sim.copy(cc);
    const steps: SolveStep[] = [];
    let lastPhase = this.phaseForState(sim, method);
    for (let i = 0; i < exps.length; i++) {
      const exp = exps[i];
      const moveIdx = this.expToMove(exp);
      // 当前动作归属的阶段 = 应用动作前的状态所处阶段
      const phase = lastPhase;
      steps.push({ exp, moveIndex: i, phase, phaseLabel: labels[phase] });
      if (moveIdx >= 0) {
        const next = new CubieCube();
        CubieCube.CornMult(CubieCube.MoveCube[moveIdx], sim, next);
        CubieCube.EdgeMult(CubieCube.MoveCube[moveIdx], sim, next);
        sim.copy(next);
      }
      lastPhase = this.phaseForState(sim, method);
    }
    // 校验：应用完整解后应到达复原状态；若不一致说明 move 映射或乘法顺序出错
    if (!Solver.isSolved(sim)) {
      // 不阻断返回，但通过 console 给出告警便于排查
      console.warn("[solvePhased] 模拟后未复原，阶段切分可能不准确", { raw });
    }

    // 合并相邻空阶段的边界，生成 phases 信息
    const phases: SolvePhaseInfo[] = labels.map((label, index) => ({
      index,
      label,
      startStep: -1,
      endStep: -1,
    }));
    for (let i = 0; i < steps.length; i++) {
      const p = steps[i].phase;
      if (phases[p].startStep === -1) phases[p].startStep = i;
      phases[p].endStep = i + 1;
    }
    for (const p of phases) {
      if (p.startStep === -1) {
        p.startStep = 0;
        p.endStep = 0;
      }
    }

    return { method, raw: exps.join(" "), steps, phases };
  }

  // 字符串动作（"R", "U2", "F'"）转 move 索引 0-17
  private expToMove(exp: string): number {
    const cleaned = exp.trim();
    if (!cleaned) return -1;
    const face = cleaned[0];
    const faceIdx = "URFDLB".indexOf(face);
    if (faceIdx < 0) return -1;
    const axis = faceIdx; // U=0,R=1,F=2,D=3,L=4,B=5
    let power = 0;
    if (cleaned.length > 1) {
      if (cleaned[1] === "2") power = 1;
      else if (cleaned[1] === "'" || cleaned[1] === "’") power = 2;
    }
    return axis * 3 + power;
  }

  // 根据当前状态判断处于哪一阶段
  private phaseForState(cube: CubieCube, method: SolveMethod): number {
    if (method === "kociemba") return 0;
    // 共用底层判定
    if (!Solver.isDCrossDone(cube)) return 0; // Cross
    if (!Solver.isDCornersDone(cube)) return method === "cfop" ? 1 : 1; // FL corners
    if (!Solver.isMiddleDone(cube)) return method === "cfop" ? 1 : 2; // middle edges (CFOP 视为 F2L)
    // 此时前两层完成
    if (!Solver.isTopCrossDone(cube)) return method === "cfop" ? 2 : 3; // LL cross / OLL edges
    if (!Solver.isTopCornersOriented(cube)) return method === "cfop" ? 2 : 4; // LL corners orient / OLL corners
    // OLL 完成（CFOP 视角），进入 PLL
    if (!Solver.isTopCornersPermuted(cube)) return method === "cfop" ? 3 : 5; // LL corners perm
    if (!Solver.isTopEdgesPermuted(cube)) return method === "cfop" ? 3 : 6; // LL edges perm
    return method === "cfop" ? 3 : 6; // solved
  }

  // D 面十字：DR(4)/DF(5)/DL(6)/DB(7) 4 条棱就位且朝向正确
  private static isDCrossDone(cube: CubieCube): boolean {
    for (let e = 4; e <= 7; e++) if (cube.ea[e] !== e * 2) return false;
    return true;
  }
  // 复原态：所有角块/棱块就位且朝向正确
  private static isSolved(cube: CubieCube): boolean {
    for (let c = 0; c < 8; c++) if (cube.ca[c] !== c) return false;
    for (let e = 0; e < 12; e++) if (cube.ea[e] !== e * 2) return false;
    return true;
  }
  // D 面四角：4-7 角块就位且朝向正确
  private static isDCornersDone(cube: CubieCube): boolean {
    for (let c = 4; c <= 7; c++) if (cube.ca[c] !== c) return false;
    return true;
  }
  // 中层棱块：FR(8)/FL(9)/BL(10)/BR(11) 就位且朝向正确
  private static isMiddleDone(cube: CubieCube): boolean {
    for (let e = 8; e <= 11; e++) if (cube.ea[e] !== e * 2) return false;
    return true;
  }
  // 顶层十字：顶层 4 条棱朝向正确（flip=0）
  private static isTopCrossDone(cube: CubieCube): boolean {
    for (let e = 0; e <= 3; e++) if ((cube.ea[e] & 1) !== 0) return false;
    return true;
  }
  // 顶层角定向：顶层 4 角 twist=0
  private static isTopCornersOriented(cube: CubieCube): boolean {
    for (let c = 0; c <= 3; c++) if ((cube.ca[c] >> 3) !== 0) return false;
    return true;
  }
  // 顶层角位置：顶层 4 角归位
  private static isTopCornersPermuted(cube: CubieCube): boolean {
    for (let c = 0; c <= 3; c++) if ((cube.ca[c] & 7) !== c) return false;
    return true;
  }
  // 顶层棱位置：顶层 4 棱归位
  private static isTopEdgesPermuted(cube: CubieCube): boolean {
    for (let e = 0; e <= 3; e++) if ((cube.ea[e] >> 1) !== e) return false;
    return true;
  }

  private conjMask: number;
  private initSearch(): void {
    this.conjMask = (Solver.TRY_INVERSE ? 0 : 0x38) | (Solver.TRY_THREE_AXES ? 0 : 0x36);
    this.maxPreMoves = this.conjMask > 7 ? 0 : Solver.MAX_PRE_MOVES;

    for (let i = 0; i < 6; i++) {
      this.urfCubieCube[i].copy(this.cc);
      this.urfCoordCube[i].setWithPrun(this.urfCubieCube[i], 20);
      this.cc.URFConjugate();
      if (i % 3 == 2) {
        this.cc.inverse();
      }
    }
  }

  private length1 = 0;
  private urfIdx = 0;
  private search(): string {
    for (this.length1 = 0; this.length1 < this.sol; this.length1++) {
      for (this.urfIdx = 0; this.urfIdx < 6; this.urfIdx++) {
        if ((this.conjMask & (1 << this.urfIdx)) != 0) {
          continue;
        }
        if (this.phase1PreMoves(this.maxPreMoves, -30, this.urfCubieCube[this.urfIdx]) == 0) {
          return this.moveSol == null ? "error: no solution for prob" : this.getSolution();
        }
      }
    }
    return this.moveSol == null ? "error: no solution for depth" : this.getSolution();
  }

  private getSolution(): string {
    let ret = "";
    if (!this.moveSol) {
      return ret;
    }
    const urf = this.urfIdx;
    if (urf < 3) {
      for (let s = 0; s < this.moveSol.length; ++s) {
        ret += Util.MOVE2STR[CubieCube.URFMove[urf][this.moveSol[s]]] + " ";
      }
    } else {
      for (let s = this.moveSol.length - 1; s >= 0; --s) {
        ret += Util.MOVE2STR[CubieCube.URFMove[urf][this.moveSol[s]]] + " ";
      }
    }
    return ret;
  }
  private depth1 = 0;

  private phase1PreMoves(maxl: number, lm: number, cc: CubieCube): number {
    this.preMoveLen = this.maxPreMoves - maxl;
    if (this.preMoveLen == 0 || ((0x36fb7 >> lm) & 1) == 0) {
      this.depth1 = this.length1 - this.preMoveLen;
      this.phase1Cubie[0].copy(cc) /* = cc*/;
      this.allowShorter = this.depth1 == Solver.MIN_P1LENGTH_PRE && this.preMoveLen != 0;

      if (
        this.nodeUD[this.depth1 + 1].setWithPrun(cc, this.depth1) &&
        this.phase1(this.nodeUD[this.depth1 + 1], this.depth1, -1) == 0
      ) {
        return 0;
      }
    }

    if (maxl == 0 || this.preMoveLen + Solver.MIN_P1LENGTH_PRE >= this.length1) {
      return 1;
    }

    let skipMoves = 0;
    if (maxl == 1 || this.preMoveLen + 1 + Solver.MIN_P1LENGTH_PRE >= this.length1) {
      //last pre move
      skipMoves |= 0x36fb7; // 11 0110 1111 1011 0111
    }

    lm = ~~(lm / 3) * 3;
    for (let m = 0; m < 18; m++) {
      if (m == lm || m == lm - 9 || m == lm + 9) {
        m += 2;
        continue;
      }
      if ((skipMoves & (1 << m)) != 0) {
        continue;
      }
      CubieCube.CornMult(CubieCube.MoveCube[m], cc, this.preMoveCubes[maxl]);
      CubieCube.EdgeMult(CubieCube.MoveCube[m], cc, this.preMoveCubes[maxl]);
      this.preMoves[this.maxPreMoves - maxl] = m;
      const ret = this.phase1PreMoves(maxl - 1, m, this.preMoveCubes[maxl]);
      if (ret == 0) {
        return 0;
      }
    }
    return 1;
  }

  private phase1(node: CoordCube, maxl: number, lm: number): number {
    if (node.prun == 0 && maxl < 5) {
      if (this.allowShorter || maxl == 0) {
        this.depth1 -= maxl;
        const ret = this.initPhase2Pre();
        this.depth1 += maxl;
        return ret;
      } else {
        return 1;
      }
    }
    for (let axis = 0; axis < 18; axis += 3) {
      if (axis == lm || axis == lm - 9) {
        continue;
      }
      for (let power = 0; power < 3; power++) {
        const m = axis + power;
        const prun = this.nodeUD[maxl].doMovePrun(node, m);
        if (prun > maxl) {
          break;
        } else if (prun == maxl) {
          continue;
        }

        this.move[this.depth1 - maxl] = m;
        this.valid1 = Math.min(this.valid1, this.depth1 - maxl);
        const ret = this.phase1(this.nodeUD[maxl], maxl - 1, axis);
        if (ret == 0) {
          return 0;
        } else if (ret == 2) {
          break;
        }
      }
    }
    return 1;
  }

  private initPhase2Pre(): number {
    for (let i = this.valid1; i < this.depth1; i++) {
      CubieCube.CornMult(this.phase1Cubie[i], CubieCube.MoveCube[this.move[i]], this.phase1Cubie[i + 1]);
      CubieCube.EdgeMult(this.phase1Cubie[i], CubieCube.MoveCube[this.move[i]], this.phase1Cubie[i + 1]);
    }
    this.valid1 = this.depth1;

    let ret = this.initPhase2(this.phase1Cubie[this.depth1]);
    if (ret == 0 || this.preMoveLen == 0 || ret == 2) {
      return ret;
    }

    const m = ~~(this.preMoves[this.preMoveLen - 1] / 3) * 3 + 1;
    CubieCube.CornMult(CubieCube.MoveCube[m], this.phase1Cubie[this.depth1], this.phase1Cubie[this.depth1 + 1]);
    CubieCube.EdgeMult(CubieCube.MoveCube[m], this.phase1Cubie[this.depth1], this.phase1Cubie[this.depth1 + 1]);

    this.preMoves[this.preMoveLen - 1] += 2 - (this.preMoves[this.preMoveLen - 1] % 3) * 2;
    ret = this.initPhase2(this.phase1Cubie[this.depth1 + 1]);
    this.preMoves[this.preMoveLen - 1] += 2 - (this.preMoves[this.preMoveLen - 1] % 3) * 2;
    return ret;
  }

  private initPhase2(phase2Cubie: CubieCube): number {
    let p2corn = phase2Cubie.CPermSym;
    const p2csym = p2corn & 0xf;
    p2corn >>= 4;
    let p2edge = phase2Cubie.EPermSym;
    const p2esym = p2edge & 0xf;
    p2edge >>= 4;
    const p2mid = phase2Cubie.MPerm;
    const p2edgei = CubieCube.GetPermSymInv(p2edge, p2esym, false);
    const p2corni = CubieCube.GetPermSymInv(p2corn, p2csym, true);
    const prun = Math.max(
      CoordCube.GetPruning(CoordCube.MCPermPrun, p2corn * CoordCube.N_MPERM + CoordCube.MPermConj[p2mid][p2csym]),
      CoordCube.GetPruning(
        CoordCube.EPermCCombPPrun,
        p2edge * CoordCube.N_COMB +
          CoordCube.CCombPConj[CubieCube.Perm2CombP[p2corn] & 0xff][CubieCube.SymMultInv[p2esym][p2csym]]
      ),
      CoordCube.GetPruning(
        CoordCube.EPermCCombPPrun,
        (p2edgei >> 4) * CoordCube.N_COMB +
          CoordCube.CCombPConj[CubieCube.Perm2CombP[p2corni >> 4] & 0xff][
            CubieCube.SymMultInv[p2edgei & 0xf][p2corni & 0xf]
          ]
      )
    );
    const maxDep2 = Math.min(Solver.MAX_DEPTH2, this.sol - this.length1);
    if (prun >= maxDep2) {
      return prun > maxDep2 ? 2 : 1;
    }
    let depth2;
    for (depth2 = maxDep2 - 1; depth2 >= prun; depth2--) {
      const ret = this.phase2(p2edge, p2esym, p2corn, p2csym, p2mid, depth2, this.depth1, 10);
      if (ret < 0) {
        break;
      }
      depth2 -= ret;
      this.moveSol = [];
      for (let i = 0; i < this.depth1 + depth2; i++) {
        this.appendSolMove(this.move[i]);
      }
      for (let i = this.preMoveLen - 1; i >= 0; i--) {
        this.appendSolMove(this.preMoves[i]);
      }
      this.sol = this.moveSol.length;
    }
    if (depth2 != maxDep2 - 1) {
      return 0;
    } else {
      return 1;
    }
  }

  private appendSolMove(move: number): void {
    if (!this.moveSol) {
      return;
    }
    if (this.moveSol.length == 0) {
      this.moveSol.push(move);
      return;
    }
    const axisCur = ~~(move / 3);
    const axisLast = ~~(this.moveSol[this.moveSol.length - 1] / 3);
    if (axisCur == axisLast) {
      const pow = ((move % 3) + (this.moveSol[this.moveSol.length - 1] % 3) + 1) % 4;
      if (pow == 3) {
        this.moveSol.pop();
      } else {
        this.moveSol[this.moveSol.length - 1] = axisCur * 3 + pow;
      }
      return;
    }
    if (
      this.moveSol.length > 1 &&
      axisCur % 3 == axisLast % 3 &&
      axisCur == ~~(this.moveSol[this.moveSol.length - 2] / 3)
    ) {
      const pow = ((move % 3) + (this.moveSol[this.moveSol.length - 2] % 3) + 1) % 4;
      if (pow == 3) {
        this.moveSol[this.moveSol.length - 2] = this.moveSol[this.moveSol.length - 1];
        this.moveSol.pop();
      } else {
        this.moveSol[this.moveSol.length - 2] = axisCur * 3 + pow;
      }
      return;
    }
    this.moveSol.push(move);
  }

  private phase2(
    edge: number,
    esym: number,
    corn: number,
    csym: number,
    mid: number,
    maxl: number,
    depth: number,
    lm: number
  ): number {
    if (edge == 0 && corn == 0 && mid == 0) {
      return maxl;
    }
    const moveMask = Util.CKMV2BIT[lm];
    for (let m = 0; m < 10; m++) {
      if (((moveMask >> m) & 1) != 0) {
        m += (0x42 >> m) & 3;
        continue;
      }
      const midx = CoordCube.MPermMove[mid][m];
      let cornx = CoordCube.CPermMove[corn][CubieCube.SymMoveUD[csym][m]];
      const csymx = CubieCube.SymMult[cornx & 0xf][csym];
      cornx >>= 4;
      let edgex = CoordCube.EPermMove[edge][CubieCube.SymMoveUD[esym][m]];
      const esymx = CubieCube.SymMult[edgex & 0xf][esym];
      edgex >>= 4;
      const edgei = CubieCube.GetPermSymInv(edgex, esymx, false);
      const corni = CubieCube.GetPermSymInv(cornx, csymx, true);
      let prun = CoordCube.GetPruning(
        CoordCube.EPermCCombPPrun,
        (edgei >> 4) * CoordCube.N_COMB +
          CoordCube.CCombPConj[CubieCube.Perm2CombP[corni >> 4] & 0xff][CubieCube.SymMultInv[edgei & 0xf][corni & 0xf]]
      );
      if (prun > maxl + 1) {
        break;
      } else if (prun >= maxl) {
        m += (0x42 >> m) & 3 & (maxl - prun);
        continue;
      }
      prun = Math.max(
        CoordCube.GetPruning(
          CoordCube.EPermCCombPPrun,
          edgex * CoordCube.N_COMB +
            CoordCube.CCombPConj[CubieCube.Perm2CombP[cornx] & 0xff][CubieCube.SymMultInv[esymx][csymx]]
        ),
        CoordCube.GetPruning(CoordCube.MCPermPrun, cornx * CoordCube.N_MPERM + CoordCube.MPermConj[midx][csymx])
      );
      if (prun >= maxl) {
        m += (0x42 >> m) & 3 & (maxl - prun);
        continue;
      }
      const ret = this.phase2(edgex, esymx, cornx, csymx, midx, maxl - 1, depth + 1, m);
      if (ret >= 0) {
        this.move[depth] = Util.UD2STD[m];
        return ret;
      }
    }
    return -1;
  }
}
