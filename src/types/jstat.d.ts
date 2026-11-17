declare module 'jstat' {
  export const jStat: {
    normal: {
      cdf: (x: number, mean: number, std: number) => number;
      inv: (p: number, mean: number, std: number) => number;
      pdf: (x: number, mean: number, std: number) => number;
    };
    chisquare: {
      cdf: (x: number, dof: number) => number;
    };
    studentt: {
      cdf: (x: number, dof: number) => number;
    };
  };
  export default jStat;
}
