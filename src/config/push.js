// Public keys only. The matching private keys are GitHub Actions secrets.
export const VAPID_PUBLIC_KEY = 'BE6tkKjxiS4Mc3Jxa7rnnMtwYmDo7knEBsFA1xqN4d-i_btx-bFqUPnxsJ_kWXYAyn4lhgcmhxI2WHyjS5BCLYI'
export const SEALING_PUBLIC_KEY = 'BEZYtF7K_sTtx_yfRCNAaWZyGlPYvFJcVTMb3MVvPMVVVvcP-wyj4-DYnrasgWcV1QjKuJQ0kl9uOYmGOhISClw'
// Set at build time from the repository variable PUSH_API_URL (the Vercel URL).
export const PUSH_API_URL = (import.meta.env?.VITE_PUSH_API_URL || '').replace(/\/+$/, '')
