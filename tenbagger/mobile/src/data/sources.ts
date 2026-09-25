/**
 * ===================== THE ONE-LINE SWAP =====================
 * These two imports are the only place the app reads bundled data.
 * To use the real pipeline/lessons output instead of the samples, change the paths to:
 *
 *   import companiesJson from '../../../data/companies.json';
 *   import lessonsJson from '../../../data/lessons.json';
 *
 * (metro.config.js already watches tenbagger/data/, so Metro can bundle files there.)
 * Everything downstream validates/normalizes through ./index.ts.
 * =============================================================
 */
import companiesJson from '../../assets/data/companies.sample.json';
import lessonsJson from '../../assets/data/lessons.sample.json';

export const rawCompanies: unknown = companiesJson;
export const rawLessons: unknown = lessonsJson;
