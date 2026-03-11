"""
Export pre-computed chart data for the /market-model page.
Reads market_data.csv (from dump-market-data.ts) and outputs chart-data.ts.

Run: python3 scripts/export-market-chart-data.py
"""
import pandas as pd
import numpy as np
from scipy import stats
import json, textwrap

# ── Load ─────────────────────────────────────────────────────────
df = pd.read_csv('scripts/market_data.csv')
blades = df[df['item_category'] == 'blade'].copy()
tosogu = df[df['item_category'] == 'tosogu'].copy()

CERT_ORDER = ['None/Reg', 'Hozon', 'TokuHozon', 'Juyo', 'Tokuju']
CERT_COLORS = {
    'None/Reg': '#6B7280',
    'Hozon': '#6B8E23',
    'TokuHozon': '#8B4513',
    'Juyo': '#4169E1',
    'Tokuju': '#7B2D8E',
}

# ── Helpers ──────────────────────────────────────────────────────
def box_stats(series, name, color):
    """Compute box-and-whisker stats."""
    s = series.dropna().values
    if len(s) == 0:
        return None
    q1, med, q3 = np.percentile(s, [25, 50, 75])
    iqr = q3 - q1
    wl = max(s.min(), q1 - 1.5 * iqr)
    wh = min(s.max(), q3 + 1.5 * iqr)
    return {
        'name': name, 'n': len(s),
        'wl': round(wl, 3), 'q1': round(q1, 3), 'med': round(med, 3),
        'q3': round(q3, 3), 'wh': round(wh, 3), 'color': color,
    }

def ols(X, y):
    """Return beta, predictions, residuals."""
    X_aug = np.column_stack([np.ones(len(y)), X])
    beta = np.linalg.lstsq(X_aug, y, rcond=None)[0]
    pred = X_aug @ beta
    resid = y - pred
    ss_res = np.sum(resid**2)
    ss_tot = np.sum((y - np.mean(y))**2)
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0
    n, p = X_aug.shape
    adj_r2 = 1 - (1 - r2) * (n - 1) / (n - p)
    rmse = np.sqrt(ss_res / n)
    within_2x = np.mean(np.abs(resid) < 0.301)
    return beta, pred, resid, adj_r2, rmse, within_2x

def quantile_ols(X, y, tau, max_iter=50, tol=1e-6):
    """Quantile regression via IRLS."""
    eps = 1e-6
    X_aug = np.column_stack([np.ones(len(y)), X])
    beta = np.linalg.lstsq(X_aug, y, rcond=None)[0]
    for _ in range(max_iter):
        pred = X_aug @ beta
        resid = y - pred
        w = np.where(resid > 0, tau / np.maximum(np.abs(resid), eps),
                     (1 - tau) / np.maximum(np.abs(resid), eps))
        W = np.diag(w)
        try:
            beta_new = np.linalg.solve(X_aug.T @ W @ X_aug, X_aug.T @ W @ y)
        except np.linalg.LinAlgError:
            break
        if np.max(np.abs(beta_new - beta)) < tol:
            beta = beta_new
            break
        beta = beta_new
    return beta

def sample_df(frame, n=600, seed=42):
    """Random sample, capped at n."""
    if len(frame) <= n:
        return frame
    return frame.sample(n=n, random_state=seed)

def reg_line(sub_x, sub_y, color, label):
    """Fit linear regression and return line endpoints."""
    if len(sub_x) < 10:
        return None
    z = np.polyfit(sub_x, sub_y, 1)
    x1, x2 = sub_x.min(), sub_x.max()
    return {'x1': round(float(x1), 2), 'y1': round(float(np.polyval(z, x1)), 3),
            'x2': round(float(x2), 2), 'y2': round(float(np.polyval(z, x2)), 3),
            'color': color, 'label': label}

# ══════════════════════════════════════════════════════════════════
# 1. Box plots: Blades + Tosogu
# ══════════════════════════════════════════════════════════════════
blade_box = []
for cert in CERT_ORDER:
    sub = blades[blades['cert_label'] == cert]
    bs = box_stats(sub['log_price'], cert, CERT_COLORS[cert])
    if bs:
        blade_box.append(bs)

tosogu_box = []
for cert in CERT_ORDER:
    sub = tosogu[tosogu['cert_label'] == cert]
    bs = box_stats(sub['log_price'], cert, CERT_COLORS[cert])
    if bs:
        tosogu_box.append(bs)

print(f"Box: {len(blade_box)} blade tiers, {len(tosogu_box)} tosogu tiers")

# ══════════════════════════════════════════════════════════════════
# 2. Tier 2N model → Predicted vs Actual + Residuals
# ══════════════════════════════════════════════════════════════════
blade_tt_n = blades.dropna(subset=['log_tt', 'log_nagasa']).copy()
blade_tt_n = blade_tt_n[blade_tt_n['cert_label'].isin(CERT_ORDER)]

X_m5in = np.column_stack([
    blade_tt_n['cert_ordinal'].values,
    blade_tt_n['item_type_ord'].values,
    blade_tt_n['log_tt'].values,
    blade_tt_n['cert_ordinal'].values * blade_tt_n['log_tt'].values,
    blade_tt_n['log_nagasa'].values,
    blade_tt_n['is_jp_dealer'].values,
])
y_m5in = blade_tt_n['log_price'].values
beta_m5in, pred_m5in, resid_m5in, adj_r2, rmse, within_2x = ols(X_m5in, y_m5in)

blade_tt_n['predicted'] = pred_m5in
blade_tt_n['residual'] = resid_m5in

model_stats = {
    'adjR2': round(adj_r2, 3),
    'rmse': round(rmse, 3),
    'within2x': round(within_2x * 100, 1),
    'n': len(blade_tt_n),
}
print(f"Tier 2N: adjR²={adj_r2:.3f}, RMSE={rmse:.3f}, n={len(blade_tt_n)}")

# Pred vs Actual scatter (sample for perf)
sampled = sample_df(blade_tt_n, 800)
pred_actual = []
for _, r in sampled.iterrows():
    pred_actual.append({
        'x': round(r['predicted'], 3),
        'y': round(r['log_price'], 3),
        'c': int(r['cert_ordinal']),
        's': 1 if r['source'] == 'private_sale' else 0,
    })
print(f"Pred vs Actual: {len(pred_actual)} points")

# ══════════════════════════════════════════════════════════════════
# 3. Residual histogram
# ══════════════════════════════════════════════════════════════════
bins_edges = np.linspace(-1.2, 1.2, 61)
bin_centers = (bins_edges[:-1] + bins_edges[1:]) / 2
counts, _ = np.histogram(resid_m5in, bins=bins_edges, density=True)
resid_hist = [{'x': round(float(c), 3), 'y': round(float(d), 4)} for c, d in zip(bin_centers, counts)]

# Normal curve overlay
mu, sigma = np.mean(resid_m5in), np.std(resid_m5in)
norm_x = np.linspace(-1.2, 1.2, 100)
norm_y = stats.norm.pdf(norm_x, mu, sigma)
resid_norm = [{'x': round(float(x), 3), 'y': round(float(y), 4)} for x, y in zip(norm_x, norm_y)]

resid_stats = {
    'skew': round(float(stats.skew(resid_m5in)), 2),
    'kurtosis': round(float(stats.kurtosis(resid_m5in)), 2),
    'mu': round(mu, 4),
    'sigma': round(sigma, 4),
}

# ══════════════════════════════════════════════════════════════════
# 4. QQ plot
# ══════════════════════════════════════════════════════════════════
sorted_resid = np.sort(resid_m5in)
n_qq = min(200, len(sorted_resid))
indices = np.linspace(0, len(sorted_resid) - 1, n_qq).astype(int)
sampled_resid = sorted_resid[indices]
theoretical = stats.norm.ppf(np.linspace(0.005, 0.995, n_qq))
qq_data = [{'t': round(float(t), 3), 's': round(float(s), 3)} for t, s in zip(theoretical, sampled_resid)]

(_, _), (qq_slope, qq_intercept, qq_r) = stats.probplot(resid_m5in, dist='norm')
qq_stats = {'slope': round(float(qq_slope), 4), 'intercept': round(float(qq_intercept), 4), 'r': round(float(qq_r), 4)}

# ══════════════════════════════════════════════════════════════════
# 5. TT vs Price by Cert
# ══════════════════════════════════════════════════════════════════
blade_tt = blades.dropna(subset=['toko_taikan']).copy()
blade_tt = blade_tt[blade_tt['cert_label'].isin(CERT_ORDER)]
sampled_tt = sample_df(blade_tt, 800)

tt_price = []
for _, r in sampled_tt.iterrows():
    tt_price.append({
        'x': int(r['toko_taikan']),
        'y': round(r['log_price'], 3),
        'c': int(r['cert_ordinal']),
    })

tt_lines = []
for cert in CERT_ORDER:
    sub = blade_tt[blade_tt['cert_label'] == cert]
    if len(sub) >= 10:
        rl = reg_line(sub['toko_taikan'].values, sub['log_price'].values, CERT_COLORS[cert], cert)
        if rl:
            tt_lines.append(rl)

print(f"TT scatter: {len(tt_price)} points, {len(tt_lines)} lines")

# ══════════════════════════════════════════════════════════════════
# 6. Nagasa vs Price
# ══════════════════════════════════════════════════════════════════
blade_nag = blades.dropna(subset=['nagasa_cm']).copy()
blade_nag = blade_nag[(blade_nag['nagasa_cm'] > 5) & (blade_nag['cert_label'].isin(CERT_ORDER))]
sampled_nag = sample_df(blade_nag, 800)

nag_price = []
for _, r in sampled_nag.iterrows():
    nag_price.append({
        'x': round(r['nagasa_cm'], 1),
        'y': round(r['log_price'], 3),
        'c': int(r['cert_ordinal']),
    })

nag_lines = []
for cert in ['None/Reg', 'Hozon', 'TokuHozon', 'Juyo']:
    sub = blade_nag[blade_nag['cert_label'] == cert]
    if len(sub) >= 10:
        rl = reg_line(sub['nagasa_cm'].values, sub['log_price'].values, CERT_COLORS[cert], cert)
        if rl:
            nag_lines.append(rl)

print(f"Nagasa scatter: {len(nag_price)} points, {len(nag_lines)} lines")

# ══════════════════════════════════════════════════════════════════
# 7. JP vs International histogram
# ══════════════════════════════════════════════════════════════════
jp_blades = blades[blades['is_jp_dealer'] == 1]['log_price']
intl_blades = blades[blades['is_jp_dealer'] == 0]['log_price']

hist_bins = np.linspace(3.5, 9.0, 56)
hist_centers = (hist_bins[:-1] + hist_bins[1:]) / 2
jp_counts, _ = np.histogram(jp_blades, bins=hist_bins, density=True)
intl_counts, _ = np.histogram(intl_blades, bins=hist_bins, density=True)

jp_intl_hist = [{'x': round(float(c), 3), 'jp': round(float(j), 4), 'intl': round(float(i), 4)}
                for c, j, i in zip(hist_centers, jp_counts, intl_counts)]

jp_intl_stats = {
    'jpN': len(jp_blades),
    'intlN': len(intl_blades),
    'jpMedian': round(float(10**jp_blades.median()), 0),
    'intlMedian': round(float(10**intl_blades.median()), 0),
}

# ══════════════════════════════════════════════════════════════════
# 8. Residual by Cert (heteroscedasticity)
# ══════════════════════════════════════════════════════════════════
# Use universal blade model (cert + item) for residuals
blade_all = blades[blades['cert_label'].isin(CERT_ORDER)].copy()
X_m1 = np.column_stack([blade_all['cert_ordinal'].values, blade_all['item_type_ord'].values])
y_m1 = blade_all['log_price'].values
_, _, resid_m1, _, _, _ = ols(X_m1, y_m1)
blade_all['residual'] = resid_m1

resid_box = []
for cert in CERT_ORDER:
    sub = blade_all[blade_all['cert_label'] == cert]
    bs = box_stats(sub['residual'], cert, CERT_COLORS[cert])
    if bs:
        resid_box.append(bs)

# ══════════════════════════════════════════════════════════════════
# 9. Private sales overlay
# ══════════════════════════════════════════════════════════════════
private_all = df[df['source'] == 'private_sale']
scraped_blades = blades[blades['source'] != 'private_sale']

priv_hist_bins = np.linspace(3.5, 9.0, 56)
priv_centers = (priv_hist_bins[:-1] + priv_hist_bins[1:]) / 2
scraped_counts, _ = np.histogram(scraped_blades['log_price'], bins=priv_hist_bins, density=True)
private_hist = [{'x': round(float(c), 3), 'y': round(float(d), 4)} for c, d in zip(priv_centers, scraped_counts)]
private_lines = sorted([round(float(r['log_price']), 3) for _, r in private_all.iterrows()])

# ══════════════════════════════════════════════════════════════════
# 10. EF vs Price by Cert
# ══════════════════════════════════════════════════════════════════
blade_ef = blades[(blades['elite_factor'] > 0) & (blades['cert_label'].isin(CERT_ORDER))].copy()
sampled_ef = sample_df(blade_ef, 700)

ef_price = []
for _, r in sampled_ef.iterrows():
    ef_price.append({
        'x': round(r['elite_factor'], 3),
        'y': round(r['log_price'], 3),
        'c': int(r['cert_ordinal']),
    })

ef_lines = []
for cert in CERT_ORDER:
    sub = blade_ef[blade_ef['cert_label'] == cert]
    if len(sub) >= 10:
        rl = reg_line(sub['elite_factor'].values, sub['log_price'].values, CERT_COLORS[cert], cert)
        if rl:
            ef_lines.append(rl)

print(f"EF scatter: {len(ef_price)} points, {len(ef_lines)} lines")

# ══════════════════════════════════════════════════════════════════
# 11. Quantile Price Bands
# ══════════════════════════════════════════════════════════════════
taus = [0.10, 0.25, 0.50, 0.75, 0.90]
q_betas = {}
for tau in taus:
    q_betas[tau] = quantile_ols(X_m5in, y_m5in, tau)

# Generate band data for TokuHozon + Juyo, katana (item_ord=3), JP dealer, nagasa=70cm
log_nagasa_70 = np.log10(70)
tt_range = np.linspace(400, 3200, 50)

def make_band(cert_ord):
    band = []
    for tt in tt_range:
        log_tt = np.log10(tt)
        point = {'tt': int(tt)}
        for tau in taus:
            beta = q_betas[tau]
            x = [cert_ord, 3, log_tt, cert_ord * log_tt, log_nagasa_70, 1]
            pred = beta[0] + sum(b * xi for b, xi in zip(beta[1:], x))
            point[f'p{int(tau*100)}'] = round(10**pred / 1e6, 2)  # millions JPY
        band.append(point)
    return band

band_toku = make_band(4)  # TokuHozon
band_juyo = make_band(5)  # Juyo

# Also add actual data points for overlay
band_actual_toku = []
band_actual_juyo = []
for _, r in blade_tt_n.iterrows():
    if r['item_type'] == 'katana':
        pt = {'tt': int(r['toko_taikan']), 'price': round(r['price_jpy'] / 1e6, 2)}
        if r['cert_ordinal'] == 4:
            band_actual_toku.append(pt)
        elif r['cert_ordinal'] == 5:
            band_actual_juyo.append(pt)

# ══════════════════════════════════════════════════════════════════
# 12. Summary table data: blade medians by cert
# ══════════════════════════════════════════════════════════════════
summary_blades = []
for cert in CERT_ORDER:
    sub = blades[blades['cert_label'] == cert]
    if len(sub) > 0:
        med = 10**sub['log_price'].median()
        q1 = 10**sub['log_price'].quantile(0.25)
        q3 = 10**sub['log_price'].quantile(0.75)
        summary_blades.append({
            'cert': cert, 'n': len(sub),
            'median': int(med), 'q1': int(q1), 'q3': int(q3),
        })

summary_tosogu = []
for cert in CERT_ORDER:
    sub = tosogu[tosogu['cert_label'] == cert]
    if len(sub) > 0:
        med = 10**sub['log_price'].median()
        summary_tosogu.append({'cert': cert, 'n': len(sub), 'median': int(med)})

# ══════════════════════════════════════════════════════════════════
# EXPORT as TypeScript
# ══════════════════════════════════════════════════════════════════
def ts_array(name, data, type_name):
    """Format as TypeScript const array."""
    json_str = json.dumps(data, separators=(',', ':'))
    return f'export const {name}: {type_name}[] = {json_str};\n'

def ts_const(name, data, type_name):
    """Format as TypeScript const object."""
    json_str = json.dumps(data, separators=(',', ':'))
    return f'export const {name}: {type_name} = {json_str};\n'

out = []
out.append('// Auto-generated chart data for /market-model page')
out.append(f'// Source: market_price_observations ({len(df)} rows)')
out.append(f'// Generated: 2026-03-11')
out.append('')

# Types
out.append('// ── Types ──────────────────────────────────────────────────────')
out.append('export type BoxStat = { name: string; n: number; wl: number; q1: number; med: number; q3: number; wh: number; color: string };')
out.append('export type SP = { x: number; y: number; c: number };')
out.append('export type SPx = { x: number; y: number; c: number; s: number };')
out.append('export type HistBin = { x: number; y: number };')
out.append('export type HistBin2 = { x: number; jp: number; intl: number };')
out.append('export type QQPoint = { t: number; s: number };')
out.append('export type BandPoint = { tt: number; p10: number; p25: number; p50: number; p75: number; p90: number };')
out.append('export type BandActual = { tt: number; price: number };')
out.append('export type RegLine = { x1: number; y1: number; x2: number; y2: number; color: string; label: string };')
out.append('export type SummaryRow = { cert: string; n: number; median: number; q1?: number; q3?: number };')
out.append('')

# Cert color map
out.append('export const CERT_COLORS: Record<number, string> = ' + json.dumps({str(k): v for k, v in {0: '#6B7280', 3: '#6B8E23', 4: '#8B4513', 5: '#4169E1', 6: '#7B2D8E'}.items()}, separators=(',', ':')) + ';')
out.append('export const CERT_LABELS: Record<number, string> = ' + json.dumps({str(k): v for k, v in {0: 'None/Reg', 3: 'Hozon', 4: 'TokuHozon', 5: 'Juyo', 6: 'Tokuju'}.items()}, separators=(',', ':')) + ';')
out.append('')

# Data
out.append('// ── Box Plot Data ──────────────────────────────────────────────')
out.append(ts_array('BLADE_BOX', blade_box, 'BoxStat'))
out.append(ts_array('TOSOGU_BOX', tosogu_box, 'BoxStat'))
out.append('')

out.append('// ── Predicted vs Actual ────────────────────────────────────────')
out.append(ts_array('PRED_ACTUAL', pred_actual, 'SPx'))
out.append(ts_const('MODEL_STATS', model_stats, '{ adjR2: number; rmse: number; within2x: number; n: number }'))
out.append('')

out.append('// ── Residual Histogram ─────────────────────────────────────────')
out.append(ts_array('RESID_HIST', resid_hist, 'HistBin'))
out.append(ts_array('RESID_NORM', resid_norm, 'HistBin'))
out.append(ts_const('RESID_STATS', resid_stats, '{ skew: number; kurtosis: number; mu: number; sigma: number }'))
out.append('')

out.append('// ── QQ Plot ───────────────────────────────────────────────────')
out.append(ts_array('QQ_DATA', qq_data, 'QQPoint'))
out.append(ts_const('QQ_STATS', qq_stats, '{ slope: number; intercept: number; r: number }'))
out.append('')

out.append('// ── TT vs Price ───────────────────────────────────────────────')
out.append(ts_array('TT_PRICE', tt_price, 'SP'))
out.append(ts_array('TT_LINES', tt_lines, 'RegLine'))
out.append('')

out.append('// ── Nagasa vs Price ───────────────────────────────────────────')
out.append(ts_array('NAG_PRICE', nag_price, 'SP'))
out.append(ts_array('NAG_LINES', nag_lines, 'RegLine'))
out.append('')

out.append('// ── JP vs International ───────────────────────────────────────')
out.append(ts_array('JP_INTL_HIST', jp_intl_hist, 'HistBin2'))
out.append(ts_const('JP_INTL_STATS', jp_intl_stats, '{ jpN: number; intlN: number; jpMedian: number; intlMedian: number }'))
out.append('')

out.append('// ── Residual by Cert ──────────────────────────────────────────')
out.append(ts_array('RESID_BOX', resid_box, 'BoxStat'))
out.append('')

out.append('// ── Private Sales ─────────────────────────────────────────────')
out.append(ts_array('PRIVATE_HIST', private_hist, 'HistBin'))
out.append(ts_array('PRIVATE_LINES', private_lines, 'number'))
out.append('')

out.append('// ── EF vs Price ───────────────────────────────────────────────')
out.append(ts_array('EF_PRICE', ef_price, 'SP'))
out.append(ts_array('EF_LINES', ef_lines, 'RegLine'))
out.append('')

out.append('// ── Quantile Bands ────────────────────────────────────────────')
out.append(ts_array('BAND_TOKU', band_toku, 'BandPoint'))
out.append(ts_array('BAND_JUYO', band_juyo, 'BandPoint'))
out.append(ts_array('BAND_ACTUAL_TOKU', band_actual_toku, 'BandActual'))
out.append(ts_array('BAND_ACTUAL_JUYO', band_actual_juyo, 'BandActual'))
out.append('')

out.append('// ── Summary Tables ────────────────────────────────────────────')
out.append(ts_array('SUMMARY_BLADES', summary_blades, 'SummaryRow'))
out.append(ts_array('SUMMARY_TOSOGU', summary_tosogu, 'SummaryRow'))

outpath = 'src/app/market-model/chart-data.ts'
import os
os.makedirs(os.path.dirname(outpath), exist_ok=True)
with open(outpath, 'w') as f:
    f.write('\n'.join(out))

print(f"\nWrote {outpath} ({sum(len(l) for l in out)} chars)")
print(f"  Pred/Actual: {len(pred_actual)} pts")
print(f"  TT scatter:  {len(tt_price)} pts")
print(f"  Nagasa:      {len(nag_price)} pts")
print(f"  EF scatter:  {len(ef_price)} pts")
print(f"  Band points: {len(band_toku)} TokuHozon, {len(band_juyo)} Juyo")
