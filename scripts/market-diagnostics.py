"""
Market Price Model — Diagnostic Plots
Run: python3 scripts/market-diagnostics.py
Output: scripts/market_diagnostics.png (multi-panel figure)
"""
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

# ── Load data ────────────────────────────────────────────────────
df = pd.read_csv('scripts/market_data.csv')
print(f"Loaded {len(df)} rows")

blades = df[df['item_category'] == 'blade'].copy()
tosogu = df[df['item_category'] == 'tosogu'].copy()
print(f"Blades: {len(blades)}, Tosogu: {len(tosogu)}")

# Cert tier ordering for plots
CERT_ORDER = ['None/Reg', 'Hozon', 'TokuHozon', 'Juyo', 'Tokuju']
CERT_COLORS = {
    'None/Reg': '#888888',
    'Hozon': '#6B8E23',     # olive
    'TokuHozon': '#8B4513',  # brown
    'Juyo': '#4169E1',       # blue
    'Tokuju': '#7B2D8E',     # purple
}

# ── OLS helper ───────────────────────────────────────────────────
def ols_fit(X, y):
    """Simple OLS returning beta, predictions, residuals, R²."""
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
    return beta, pred, resid, r2, adj_r2, rmse

# ── Quantile regression (IRLS) ───────────────────────────────────
def quantile_fit(X, y, tau, max_iter=50, tol=1e-6):
    """Quantile regression via IRLS with pinball loss."""
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
    pred = X_aug @ beta
    return beta, pred

# ── Build V3 best model (M5in: cert + item + log(TT) + cert×log(TT) + log(nagasa) + jp_dealer) ──
blade_tt_n = blades.dropna(subset=['log_tt', 'log_nagasa']).copy()
blade_tt_n = blade_tt_n[blade_tt_n['cert_label'].isin(CERT_ORDER)]
print(f"\nTier 2N model (blades with TT + nagasa): n={len(blade_tt_n)}")

if len(blade_tt_n) > 50:
    X_m5in = np.column_stack([
        blade_tt_n['cert_ordinal'].values,
        blade_tt_n['item_type_ord'].values,
        blade_tt_n['log_tt'].values,
        blade_tt_n['cert_ordinal'].values * blade_tt_n['log_tt'].values,
        blade_tt_n['log_nagasa'].values,
        blade_tt_n['is_jp_dealer'].values,
    ])
    y_m5in = blade_tt_n['log_price'].values
    beta_m5in, pred_m5in, resid_m5in, r2_m5in, adj_r2_m5in, rmse_m5in = ols_fit(X_m5in, y_m5in)
    blade_tt_n['predicted'] = pred_m5in
    blade_tt_n['residual'] = resid_m5in
    print(f"  R²={r2_m5in:.3f}, adjR²={adj_r2_m5in:.3f}, RMSE={rmse_m5in:.3f}")
    print(f"  Beta: {[f'{b:.3f}' for b in beta_m5in]}")
    print(f"  (intercept, cert, item, log_tt, cert×log_tt, log_nagasa, jp_dealer)")

# Also build universal blade model (M1: cert + item)
blade_all = blades[blades['cert_label'].isin(CERT_ORDER)].copy()
X_m1 = np.column_stack([
    blade_all['cert_ordinal'].values,
    blade_all['item_type_ord'].values,
])
y_m1 = blade_all['log_price'].values
beta_m1, pred_m1, resid_m1, r2_m1, _, rmse_m1 = ols_fit(X_m1, y_m1)
blade_all['predicted'] = pred_m1
blade_all['residual'] = resid_m1

# ── Quantile predictions for Tier 2N ─────────────────────────────
taus = [0.10, 0.25, 0.50, 0.75, 0.90]
q_betas = {}
for tau in taus:
    qb, _ = quantile_fit(X_m5in, y_m5in, tau)
    q_betas[tau] = qb

# ── CREATE THE FIGURE ─────────────────────────────────────────────
fig = plt.figure(figsize=(24, 30))
fig.suptitle('Market Price Model — Diagnostic Plots', fontsize=20, fontweight='bold', y=0.98)

# ══════════════════════════════════════════════════════════════════
# PLOT 1: Price Distribution by Cert Tier (Blades) — Box + Strip
# ══════════════════════════════════════════════════════════════════
ax1 = fig.add_subplot(4, 3, 1)
cert_data = []
cert_labels_plot = []
for cert in CERT_ORDER:
    sub = blades[blades['cert_label'] == cert]
    if len(sub) > 0:
        cert_data.append(sub['log_price'].values)
        cert_labels_plot.append(f"{cert}\n(n={len(sub)})")

bp = ax1.boxplot(cert_data, labels=cert_labels_plot, patch_artist=True,
                 medianprops=dict(color='black', linewidth=2),
                 flierprops=dict(marker='.', markersize=3, alpha=0.3))
for i, cert in enumerate(CERT_ORDER[:len(cert_data)]):
    bp['boxes'][i].set_facecolor(CERT_COLORS.get(cert, '#ccc'))
    bp['boxes'][i].set_alpha(0.6)

ax1.set_ylabel('log₁₀(Price JPY)')
ax1.set_title('1. Price Ladder by Cert Tier (Blades)', fontweight='bold')
# Add JPY ticks on right
ax1r = ax1.twinx()
ax1r.set_ylim(ax1.get_ylim())
yticks = [4, 5, 6, 7, 8, 9]
ax1r.set_yticks(yticks)
ax1r.set_yticklabels([f'¥{10**y:,.0f}' for y in yticks], fontsize=7)
ax1.grid(axis='y', alpha=0.3)

# ══════════════════════════════════════════════════════════════════
# PLOT 2: Price Distribution by Cert Tier (Tosogu)
# ══════════════════════════════════════════════════════════════════
ax2 = fig.add_subplot(4, 3, 2)
cert_data_t = []
cert_labels_t = []
for cert in CERT_ORDER:
    sub = tosogu[tosogu['cert_label'] == cert]
    if len(sub) > 0:
        cert_data_t.append(sub['log_price'].values)
        cert_labels_t.append(f"{cert}\n(n={len(sub)})")

if cert_data_t:
    bp2 = ax2.boxplot(cert_data_t, labels=cert_labels_t, patch_artist=True,
                      medianprops=dict(color='black', linewidth=2),
                      flierprops=dict(marker='.', markersize=3, alpha=0.3))
    for i, cert in enumerate(CERT_ORDER[:len(cert_data_t)]):
        bp2['boxes'][i].set_facecolor(CERT_COLORS.get(cert, '#ccc'))
        bp2['boxes'][i].set_alpha(0.6)

ax2.set_ylabel('log₁₀(Price JPY)')
ax2.set_title('2. Price Ladder by Cert Tier (Tosogu)', fontweight='bold')
ax2r = ax2.twinx()
ax2r.set_ylim(ax2.get_ylim())
yticks2 = [4, 5, 6, 7, 8]
ax2r.set_yticks(yticks2)
ax2r.set_yticklabels([f'¥{10**y:,.0f}' for y in yticks2], fontsize=7)
ax2.grid(axis='y', alpha=0.3)

# ══════════════════════════════════════════════════════════════════
# PLOT 3: Predicted vs Actual (Tier 2N model — best CV)
# ══════════════════════════════════════════════════════════════════
ax3 = fig.add_subplot(4, 3, 3)
if len(blade_tt_n) > 50:
    private = blade_tt_n[blade_tt_n['source'] == 'private_sale']
    scraped = blade_tt_n[blade_tt_n['source'] != 'private_sale']

    for cert in CERT_ORDER:
        sub = scraped[scraped['cert_label'] == cert]
        if len(sub) > 0:
            ax3.scatter(sub['predicted'], sub['log_price'],
                       c=CERT_COLORS.get(cert, '#ccc'), s=12, alpha=0.4, label=cert)

    if len(private) > 0:
        ax3.scatter(private['predicted'], private['log_price'],
                   c='red', s=60, marker='*', zorder=5, label='Private sale', edgecolors='black', linewidths=0.5)

    lims = [min(ax3.get_xlim()[0], ax3.get_ylim()[0]), max(ax3.get_xlim()[1], ax3.get_ylim()[1])]
    ax3.plot(lims, lims, 'k--', alpha=0.5, linewidth=1)
    # ±2x band (±0.301 in log10)
    ax3.fill_between(lims, [l - 0.301 for l in lims], [l + 0.301 for l in lims],
                     alpha=0.08, color='green')
    ax3.set_xlim(lims)
    ax3.set_ylim(lims)
    ax3.set_xlabel('Predicted log₁₀(Price)')
    ax3.set_ylabel('Actual log₁₀(Price)')
    ax3.legend(fontsize=7, loc='upper left')

ax3.set_title(f'3. Predicted vs Actual (Tier 2N, adjR²={adj_r2_m5in:.3f})', fontweight='bold')
ax3.set_aspect('equal')
ax3.grid(alpha=0.3)

# ══════════════════════════════════════════════════════════════════
# PLOT 4: Residual Histogram + Normal Fit
# ══════════════════════════════════════════════════════════════════
ax4 = fig.add_subplot(4, 3, 4)
if len(blade_tt_n) > 50:
    ax4.hist(resid_m5in, bins=50, density=True, alpha=0.7, color='steelblue', edgecolor='white')
    mu, sigma = np.mean(resid_m5in), np.std(resid_m5in)
    x_norm = np.linspace(mu - 4*sigma, mu + 4*sigma, 200)
    ax4.plot(x_norm, stats.norm.pdf(x_norm, mu, sigma), 'r-', linewidth=2, label=f'N({mu:.3f}, {sigma:.3f}²)')
    ax4.axvline(0, color='black', linewidth=1, linestyle='--')
    ax4.set_xlabel('Residual (log₁₀ scale)')
    ax4.set_ylabel('Density')
    ax4.legend(fontsize=8)

    # Skew and kurtosis
    skew = stats.skew(resid_m5in)
    kurt = stats.kurtosis(resid_m5in)
    ax4.text(0.97, 0.95, f'skew={skew:.2f}\nkurtosis={kurt:.2f}',
             transform=ax4.transAxes, ha='right', va='top', fontsize=8,
             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

ax4.set_title('4. Residual Distribution (Tier 2N)', fontweight='bold')
ax4.grid(axis='y', alpha=0.3)

# ══════════════════════════════════════════════════════════════════
# PLOT 5: QQ Plot of Residuals
# ══════════════════════════════════════════════════════════════════
ax5 = fig.add_subplot(4, 3, 5)
if len(blade_tt_n) > 50:
    (osm, osr), (slope, intercept, r_val) = stats.probplot(resid_m5in, dist='norm')
    ax5.scatter(osm, osr, s=8, alpha=0.5, c='steelblue')
    xlim = ax5.get_xlim()
    ax5.plot(xlim, [slope*x + intercept for x in xlim], 'r-', linewidth=2)
    ax5.set_xlabel('Theoretical Quantiles')
    ax5.set_ylabel('Sample Quantiles')
    ax5.text(0.05, 0.95, f'r={r_val:.4f}', transform=ax5.transAxes, ha='left', va='top', fontsize=9,
             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

ax5.set_title('5. QQ Plot — Residual Normality', fontweight='bold')
ax5.grid(alpha=0.3)

# ══════════════════════════════════════════════════════════════════
# PLOT 6: Toko Taikan vs Price by Cert Tier (interaction effect)
# ══════════════════════════════════════════════════════════════════
ax6 = fig.add_subplot(4, 3, 6)
blade_tt = blades.dropna(subset=['toko_taikan']).copy()
for cert in CERT_ORDER:
    sub = blade_tt[blade_tt['cert_label'] == cert]
    if len(sub) >= 5:
        ax6.scatter(sub['toko_taikan'], sub['log_price'],
                   c=CERT_COLORS.get(cert, '#ccc'), s=15, alpha=0.4, label=f'{cert} (n={len(sub)})')
        # Add regression line within tier
        if len(sub) >= 10:
            z = np.polyfit(sub['toko_taikan'], sub['log_price'], 1)
            x_fit = np.linspace(sub['toko_taikan'].min(), sub['toko_taikan'].max(), 50)
            ax6.plot(x_fit, np.polyval(z, x_fit), color=CERT_COLORS.get(cert, '#ccc'),
                    linewidth=2, alpha=0.8)

ax6.set_xlabel('Toko Taikan Rating')
ax6.set_ylabel('log₁₀(Price JPY)')
ax6.legend(fontsize=7, loc='upper left')
ax6.set_title('6. TT vs Price by Cert Tier (Interaction)', fontweight='bold')
ax6r = ax6.twinx()
ax6r.set_ylim(ax6.get_ylim())
ax6r.set_yticks([5, 6, 7, 8])
ax6r.set_yticklabels(['¥100K', '¥1M', '¥10M', '¥100M'], fontsize=7)
ax6.grid(alpha=0.3)

# ══════════════════════════════════════════════════════════════════
# PLOT 7: Nagasa vs Price by Cert Tier
# ══════════════════════════════════════════════════════════════════
ax7 = fig.add_subplot(4, 3, 7)
blade_nag = blades.dropna(subset=['nagasa_cm']).copy()
blade_nag = blade_nag[blade_nag['nagasa_cm'] > 5]  # filter measurement errors
for cert in ['None/Reg', 'Hozon', 'TokuHozon', 'Juyo']:
    sub = blade_nag[blade_nag['cert_label'] == cert]
    if len(sub) >= 5:
        ax7.scatter(sub['nagasa_cm'], sub['log_price'],
                   c=CERT_COLORS.get(cert, '#ccc'), s=10, alpha=0.3, label=f'{cert} (n={len(sub)})')
        if len(sub) >= 10:
            z = np.polyfit(sub['nagasa_cm'], sub['log_price'], 1)
            x_fit = np.linspace(sub['nagasa_cm'].min(), sub['nagasa_cm'].max(), 50)
            ax7.plot(x_fit, np.polyval(z, x_fit), color=CERT_COLORS.get(cert, '#ccc'),
                    linewidth=2, alpha=0.8)

ax7.set_xlabel('Nagasa (cm)')
ax7.set_ylabel('log₁₀(Price JPY)')
ax7.legend(fontsize=7, loc='upper left')
ax7.set_title('7. Blade Length vs Price by Cert Tier', fontweight='bold')
ax7.grid(alpha=0.3)

# ══════════════════════════════════════════════════════════════════
# PLOT 8: JP vs International Price Distribution
# ══════════════════════════════════════════════════════════════════
ax8 = fig.add_subplot(4, 3, 8)
jp_blades = blades[blades['is_jp_dealer'] == 1]['log_price']
intl_blades = blades[blades['is_jp_dealer'] == 0]['log_price']

bins = np.linspace(3.5, 9, 60)
ax8.hist(jp_blades, bins=bins, alpha=0.6, color='#E74C3C', density=True,
         label=f'JP dealers (n={len(jp_blades)}, med=¥{10**jp_blades.median():,.0f})')
ax8.hist(intl_blades, bins=bins, alpha=0.6, color='#3498DB', density=True,
         label=f'International (n={len(intl_blades)}, med=¥{10**intl_blades.median():,.0f})')
ax8.axvline(jp_blades.median(), color='#E74C3C', linestyle='--', linewidth=1.5)
ax8.axvline(intl_blades.median(), color='#3498DB', linestyle='--', linewidth=1.5)
ax8.set_xlabel('log₁₀(Price JPY)')
ax8.set_ylabel('Density')
ax8.legend(fontsize=7)
ax8.set_title('8. JP vs International Pricing (Blades)', fontweight='bold')
ax8.grid(axis='y', alpha=0.3)

# ══════════════════════════════════════════════════════════════════
# PLOT 9: Residual Variance by Cert Tier (Heteroscedasticity)
# ══════════════════════════════════════════════════════════════════
ax9 = fig.add_subplot(4, 3, 9)
if len(blade_all) > 50:
    resid_by_cert = []
    cert_names_v = []
    for cert in CERT_ORDER:
        sub = blade_all[blade_all['cert_label'] == cert]
        if len(sub) >= 5:
            resid_by_cert.append(sub['residual'].values)
            cert_names_v.append(f"{cert}\nσ²={np.var(sub['residual']):.3f}\n(n={len(sub)})")

    bp9 = ax9.boxplot(resid_by_cert, labels=cert_names_v, patch_artist=True,
                      medianprops=dict(color='black', linewidth=2),
                      flierprops=dict(marker='.', markersize=3, alpha=0.3))
    for i, cert in enumerate(CERT_ORDER[:len(resid_by_cert)]):
        bp9['boxes'][i].set_facecolor(CERT_COLORS.get(cert, '#ccc'))
        bp9['boxes'][i].set_alpha(0.6)

    ax9.axhline(0, color='black', linewidth=1, linestyle='--')
    ax9.set_ylabel('Residual (log₁₀ scale)')

ax9.set_title('9. Residual Spread by Cert Tier (Heteroscedasticity)', fontweight='bold')
ax9.grid(axis='y', alpha=0.3)

# ══════════════════════════════════════════════════════════════════
# PLOT 10: Private Observations vs Scraped Distribution
# ══════════════════════════════════════════════════════════════════
ax10 = fig.add_subplot(4, 3, 10)
private_all = df[df['source'] == 'private_sale'].copy()
scraped_all = df[df['source'] != 'private_sale'].copy()
scraped_blades = scraped_all[scraped_all['item_category'] == 'blade']

ax10.hist(scraped_blades['log_price'], bins=50, alpha=0.5, color='steelblue', density=True,
          label=f'Scraped blades (n={len(scraped_blades)})')

if len(private_all) > 0:
    for _, row in private_all.iterrows():
        ax10.axvline(row['log_price'], color='red', alpha=0.6, linewidth=1.5)
    # Dummy for legend
    ax10.axvline(np.nan, color='red', linewidth=2, label=f'Private sales (n={len(private_all)})')

ax10.set_xlabel('log₁₀(Price JPY)')
ax10.set_ylabel('Density')
ax10.legend(fontsize=8)
ax10.set_title('10. Private Sales vs Scraped Distribution', fontweight='bold')
# Add price labels on top
ax10t = ax10.twiny()
ax10t.set_xlim(ax10.get_xlim())
price_ticks = [5, 6, 7, 8, 8.3]
ax10t.set_xticks(price_ticks)
ax10t.set_xticklabels(['¥100K', '¥1M', '¥10M', '¥100M', '¥200M'], fontsize=7)
ax10.grid(axis='y', alpha=0.3)

# ══════════════════════════════════════════════════════════════════
# PLOT 11: Elite Factor vs Price by Cert Tier
# ══════════════════════════════════════════════════════════════════
ax11 = fig.add_subplot(4, 3, 11)
blade_ef = blades[blades['elite_factor'] > 0].copy()
for cert in CERT_ORDER:
    sub = blade_ef[blade_ef['cert_label'] == cert]
    if len(sub) >= 3:
        ax11.scatter(sub['elite_factor'], sub['log_price'],
                    c=CERT_COLORS.get(cert, '#ccc'), s=15, alpha=0.4, label=f'{cert} (n={len(sub)})')
        if len(sub) >= 10:
            z = np.polyfit(sub['elite_factor'], sub['log_price'], 1)
            x_fit = np.linspace(sub['elite_factor'].min(), sub['elite_factor'].max(), 50)
            ax11.plot(x_fit, np.polyval(z, x_fit), color=CERT_COLORS.get(cert, '#ccc'),
                     linewidth=2, alpha=0.8)

ax11.set_xlabel('Elite Factor')
ax11.set_ylabel('log₁₀(Price JPY)')
ax11.legend(fontsize=7, loc='upper left')
ax11.set_title('11. Elite Factor vs Price by Cert Tier', fontweight='bold')
ax11r = ax11.twinx()
ax11r.set_ylim(ax11.get_ylim())
ax11r.set_yticks([5, 6, 7, 8])
ax11r.set_yticklabels(['¥100K', '¥1M', '¥10M', '¥100M'], fontsize=7)
ax11.grid(alpha=0.3)

# ══════════════════════════════════════════════════════════════════
# PLOT 12: Quantile Price Bands — Sample Predictions
# ══════════════════════════════════════════════════════════════════
ax12 = fig.add_subplot(4, 3, 12)
if q_betas:
    # For a katana (item_type_ord=3), JP dealer, nagasa=70cm
    # Sweep TT at TokuHozon (cert=4) and Juyo (cert=5)
    log_nagasa = np.log10(70)
    tt_range = np.linspace(500, 3000, 50)

    for cert_ord, cert_name, color in [(4, 'TokuHozon', CERT_COLORS['TokuHozon']),
                                        (5, 'Juyo', CERT_COLORS['Juyo'])]:
        bands = {}
        for tau in taus:
            beta = q_betas[tau]
            preds = []
            for tt in tt_range:
                log_tt = np.log10(tt)
                x = [cert_ord, 3, log_tt, cert_ord * log_tt, log_nagasa, 1]
                pred = beta[0] + sum(b * xi for b, xi in zip(beta[1:], x))
                preds.append(10**pred / 1e6)  # Convert to millions
            bands[tau] = preds

        ax12.fill_between(tt_range, bands[0.10], bands[0.90], alpha=0.15, color=color)
        ax12.fill_between(tt_range, bands[0.25], bands[0.75], alpha=0.25, color=color)
        ax12.plot(tt_range, bands[0.50], color=color, linewidth=2, label=f'{cert_name} median')

    # Overlay actual data points
    for cert_ord, cert_name in [(4, 'TokuHozon'), (5, 'Juyo')]:
        sub = blade_tt_n[
            (blade_tt_n['cert_ordinal'] == cert_ord) &
            (blade_tt_n['item_type'] == 'katana')
        ]
        if len(sub) > 0:
            ax12.scatter(sub['toko_taikan'], sub['price_jpy'] / 1e6,
                        c=CERT_COLORS.get(cert_name, '#ccc'), s=10, alpha=0.3, zorder=2)

    ax12.set_xlabel('Toko Taikan Rating')
    ax12.set_ylabel('Price (¥ millions)')
    ax12.set_yscale('log')
    ax12.legend(fontsize=8)
    ax12.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, p: f'¥{x:.0f}M' if x >= 1 else f'¥{x*1000:.0f}K'))

ax12.set_title('12. Quantile Price Bands (Katana, 70cm, JP)', fontweight='bold')
ax12.grid(alpha=0.3)

# ── Layout & Save ─────────────────────────────────────────────────
plt.tight_layout(rect=[0, 0, 1, 0.97])
out_path = 'scripts/market_diagnostics.png'
plt.savefig(out_path, dpi=150, bbox_inches='tight', facecolor='white')
print(f"\nSaved to {out_path}")

# ── Summary Stats ─────────────────────────────────────────────────
print("\n" + "="*60)
print("SUMMARY STATISTICS")
print("="*60)

print(f"\nTotal observations: {len(df)}")
print(f"  Blades: {len(blades)}")
print(f"  Tosogu: {len(tosogu)}")
print(f"  Private sales: {len(private_all)}")

print(f"\nBlade medians by cert tier:")
for cert in CERT_ORDER:
    sub = blades[blades['cert_label'] == cert]
    if len(sub) > 0:
        med = 10**sub['log_price'].median()
        p25 = 10**sub['log_price'].quantile(0.25)
        p75 = 10**sub['log_price'].quantile(0.75)
        print(f"  {cert:12s}: ¥{med:>12,.0f}  (IQR: ¥{p25:>10,.0f} – ¥{p75:>10,.0f})  n={len(sub)}")

print(f"\nTosogu medians by cert tier:")
for cert in CERT_ORDER:
    sub = tosogu[tosogu['cert_label'] == cert]
    if len(sub) > 0:
        med = 10**sub['log_price'].median()
        print(f"  {cert:12s}: ¥{med:>12,.0f}  n={len(sub)}")

print(f"\nJP vs International (blades):")
print(f"  JP median:   ¥{10**jp_blades.median():>12,.0f}  (n={len(jp_blades)})")
print(f"  Intl median: ¥{10**intl_blades.median():>12,.0f}  (n={len(intl_blades)})")
print(f"  Ratio: {10**(intl_blades.median() - jp_blades.median()):.2f}x")

if len(blade_tt_n) > 50:
    within_2x = np.mean(np.abs(resid_m5in) < 0.301)
    within_50 = np.mean(np.abs(resid_m5in) < np.log10(1.5))
    print(f"\nTier 2N model accuracy:")
    print(f"  adjR²: {adj_r2_m5in:.3f}")
    print(f"  RMSE:  {rmse_m5in:.3f}")
    print(f"  Within 2×: {within_2x:.1%}")
    print(f"  Within 50%: {within_50:.1%}")
    print(f"  Median |residual|: {np.median(np.abs(resid_m5in)):.3f} → ±{(10**np.median(np.abs(resid_m5in)) - 1)*100:.0f}%")

print("\n✓ Done. Open scripts/market_diagnostics.png")
