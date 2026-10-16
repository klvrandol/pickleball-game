import {t} from './i18n/index.ts';
/** Menu copy lives here so future translations can replace a single dictionary. */
const createTitleCopy = () => ({
  title:'PICKLE COURT', subtitle:t('ui.223'), eyebrow:t('ui.222'),
  doubles:t("ui.000"), singles:t("ui.001"), settings:t("ui.002"), help:t("ui.003"), close:t("ui.004"),
  featured:t("ui.010"), doublesHint:t("ui.011"), singlesHint:t("ui.012"),
  loading:t("ui.013"), ready:t("ui.014"), error:t("ui.015"),
  footer:t("ui.016"), speed:t("ui.017"), sound:t("ui.018"), volume:t("ui.019"), names:t("ui.020"), motion:t("ui.021"), saved:t("ui.022"),
  speeds:[['0.5',t("ui.023")],['0.75',t("ui.024")],['1',t("ui.025")]],
  controls:[['W A S D',t("ui.027")],[t("ui.028"),t("ui.029")],[t("ui.030"),t("ui.031")],[t("ui.032"),t("ui.033")],['Space',t("ui.034")],['P / Esc',t("ui.035")]],
  tips:[t("ui.036"),t("ui.037"),t("ui.038"),t("ui.039")],
});
export const TITLE_COPY = new Proxy({} as ReturnType<typeof createTitleCopy>,{get(_target,key){return createTitleCopy()[key as keyof ReturnType<typeof createTitleCopy>];}});
