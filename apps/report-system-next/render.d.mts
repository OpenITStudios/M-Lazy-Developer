export interface ReportNextOutput {html:string;json:string;digest:string;fileStem:string;report:unknown}
export declare function renderReportNext(input:unknown,options?:{authorizeRuntimeEvidence?:(x:{
  mapId:string;artifactId:string;artifactFingerprint:string;evidence:unknown
})=>boolean}):Promise<ReportNextOutput>;
