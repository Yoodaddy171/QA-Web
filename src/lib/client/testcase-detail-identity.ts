type DetailIdentity = {
  id: string;
  sourceTestCaseId?: string | null;
  detailSource?: string;
  reportedAt?: string | null;
};

export function isBugDetail(detail: DetailIdentity | null | undefined) {
  return detail?.detailSource === 'bugfix' || Boolean(detail?.sourceTestCaseId && detail?.reportedAt);
}

// Bug record identity belongs to navigation/lifecycle; related data belongs to its source testcase.
export function detailTestCaseId(detail: DetailIdentity | null | undefined) {
  return detail?.sourceTestCaseId?.trim() || detail?.id || '';
}

export function detailTab(tab: string, bugDetail: boolean) {
  return tab === 'lifecycle' && !bugDetail ? 'details' : tab;
}
