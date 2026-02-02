const reportService = require('../services/reportService');
const logger = require('../utils/logger');

const reportController = {
  /**
   * Rapport financier journalier
   * GET /api/reports/financial/daily
   */
  getDailyFinancial: async (req, res) => {
    try {
      const { date } = req.query;
      const reportDate = date ? new Date(date) : new Date();

      const report = await reportService.getDailyFinancialReport(reportDate);

      logger.info('Daily financial report generated', { date: report.date, total: report.totalAmount });

      res.json(report);
    } catch (error) {
      logger.error('Daily financial report error:', error);
      res.status(500).json({ error: 'Erreur lors de la generation du rapport' });
    }
  },

  /**
   * Rapport financier par periode
   * GET /api/reports/financial/period
   */
  getPeriodFinancial: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Les dates de debut et de fin sont requises' });
      }

      const report = await reportService.getPeriodFinancialReport(
        new Date(startDate),
        new Date(endDate)
      );

      logger.info('Period financial report generated', { period: report.period, total: report.totalAmount });

      res.json(report);
    } catch (error) {
      logger.error('Period financial report error:', error);
      res.status(500).json({ error: 'Erreur lors de la generation du rapport' });
    }
  },

  /**
   * Rapport d'activite par service
   * GET /api/reports/activity/service
   */
  getServiceActivity: async (req, res) => {
    try {
      const { category, startDate, endDate } = req.query;

      if (!category || !startDate || !endDate) {
        return res.status(400).json({ error: 'Categorie et periode requises' });
      }

      if (!['RADIOLOGY', 'LABORATORY'].includes(category)) {
        return res.status(400).json({ error: 'Categorie invalide. Utiliser RADIOLOGY ou LABORATORY' });
      }

      const report = await reportService.getServiceActivityReport(
        category,
        new Date(startDate),
        new Date(endDate)
      );

      logger.info('Service activity report generated', { category, totalExams: report.totalExams });

      res.json(report);
    } catch (error) {
      logger.error('Service activity report error:', error);
      res.status(500).json({ error: 'Erreur lors de la generation du rapport' });
    }
  },

  /**
   * Statistiques globales pour le dashboard
   * GET /api/reports/stats/global
   */
  getGlobalStats: async (req, res) => {
    try {
      const stats = await reportService.getGlobalStats();
      res.json(stats);
    } catch (error) {
      logger.error('Global stats error:', error);
      res.status(500).json({ error: 'Erreur lors de la recuperation des statistiques' });
    }
  },

  /**
   * Export Excel
   * GET /api/reports/export/excel
   */
  exportExcel: async (req, res) => {
    try {
      const { reportType, date, startDate, endDate, category } = req.query;

      let data;
      if (reportType === 'financial') {
        if (startDate && endDate) {
          data = await reportService.getPeriodFinancialReport(new Date(startDate), new Date(endDate));
        } else {
          data = await reportService.getDailyFinancialReport(new Date(date || Date.now()));
        }
      } else if (reportType === 'activity') {
        if (!category || !startDate || !endDate) {
          return res.status(400).json({ error: 'Parametres manquants pour le rapport d\'activite' });
        }
        data = await reportService.getServiceActivityReport(
          category,
          new Date(startDate),
          new Date(endDate)
        );
      } else {
        return res.status(400).json({ error: 'Type de rapport invalide' });
      }

      const excelData = await reportService.generateExcelData(data, reportType);

      // Generer CSV (format simple sans dependance externe)
      let csv = excelData.headers.join(';') + '\n';
      excelData.rows.forEach(row => {
        csv += row.join(';') + '\n';
      });
      csv += '\n';
      csv += `Total;${reportType === 'financial' ? excelData.summary.totalPayments : excelData.summary.totalExams};${reportType === 'financial' ? excelData.summary.totalAmount : excelData.summary.totalRevenue}\n`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=rapport_${reportType}_${Date.now()}.csv`);
      res.send('\uFEFF' + csv); // BOM pour Excel

      logger.info('Excel/CSV report exported', { reportType });
    } catch (error) {
      logger.error('Excel export error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'export' });
    }
  },

  /**
   * Export PDF (simplifie - genere HTML)
   * GET /api/reports/export/pdf
   */
  exportPDF: async (req, res) => {
    try {
      const { reportType, date, startDate, endDate, category } = req.query;

      let data;
      let title;
      if (reportType === 'financial') {
        data = await reportService.getDailyFinancialReport(new Date(date || Date.now()));
        title = `Rapport Financier du ${data.date}`;
      } else if (reportType === 'activity') {
        if (!category || !startDate || !endDate) {
          return res.status(400).json({ error: 'Parametres manquants' });
        }
        data = await reportService.getServiceActivityReport(category, new Date(startDate), new Date(endDate));
        title = `Rapport d'Activite ${data.categoryLabel}`;
      } else {
        return res.status(400).json({ error: 'Type de rapport invalide' });
      }

      // Generer HTML pour impression/PDF
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #1976d2; text-align: center; }
    h2 { color: #333; border-bottom: 2px solid #1976d2; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #1976d2; color: white; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .summary { background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary h3 { margin-top: 0; }
    .footer { text-align: center; margin-top: 40px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <h1>CHU Tokoin</h1>
  <h2>${title}</h2>

  <div class="summary">
    <h3>Resume</h3>
    ${reportType === 'financial' ? `
    <p><strong>Nombre de paiements:</strong> ${data.totalPayments}</p>
    <p><strong>Montant total:</strong> ${data.totalAmount?.toLocaleString('fr-FR')} FCFA</p>
    ` : `
    <p><strong>Nombre d'examens:</strong> ${data.totalExams}</p>
    <p><strong>Recettes totales:</strong> ${data.totalRevenue?.toLocaleString('fr-FR')} FCFA</p>
    `}
  </div>

  ${reportType === 'financial' ? `
  <h3>Par methode de paiement</h3>
  <table>
    <tr><th>Methode</th><th>Montant (FCFA)</th></tr>
    ${Object.entries(data.byPaymentMethod || {}).map(([method, amount]) =>
      `<tr><td>${method}</td><td>${amount?.toLocaleString('fr-FR')}</td></tr>`
    ).join('')}
  </table>

  <h3>Par caissier</h3>
  <table>
    <tr><th>Caissier</th><th>Montant (FCFA)</th></tr>
    ${Object.entries(data.byCashier || {}).map(([name, amount]) =>
      `<tr><td>${name}</td><td>${amount?.toLocaleString('fr-FR')}</td></tr>`
    ).join('')}
  </table>

  <h3>Detail des paiements</h3>
  <table>
    <tr>
      <th>N° Paiement</th>
      <th>Patient</th>
      <th>Montant</th>
      <th>Methode</th>
      <th>Caissier</th>
      <th>Heure</th>
    </tr>
    ${(data.payments || []).map(p => `
    <tr>
      <td>${p.paymentNumber}</td>
      <td>${p.patientName}</td>
      <td>${p.amount?.toLocaleString('fr-FR')} FCFA</td>
      <td>${p.paymentMethod}</td>
      <td>${p.cashier}</td>
      <td>${new Date(p.time).toLocaleTimeString('fr-FR')}</td>
    </tr>
    `).join('')}
  </table>
  ` : `
  <h3>Par type d'examen</h3>
  <table>
    <tr><th>Examen</th><th>Code</th><th>Nombre</th><th>Recettes (FCFA)</th></tr>
    ${(data.byExamType || []).map(e =>
      `<tr><td>${e.name}</td><td>${e.code}</td><td>${e.count}</td><td>${e.revenue?.toLocaleString('fr-FR')}</td></tr>`
    ).join('')}
  </table>

  <h3>Par technicien</h3>
  <table>
    <tr><th>Technicien</th><th>Examens realises</th></tr>
    ${(data.byTechnician || []).map(t =>
      `<tr><td>${t.name}</td><td>${t.count}</td></tr>`
    ).join('')}
  </table>
  `}

  <div class="footer">
    <p>Genere le ${new Date().toLocaleString('fr-FR')}</p>
    <p>CHU Tokoin - Systeme de Gestion des Examens Medicaux</p>
  </div>
</body>
</html>
      `;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=rapport_${reportType}_${Date.now()}.html`);
      res.send(html);

      logger.info('PDF/HTML report exported', { reportType });
    } catch (error) {
      logger.error('PDF export error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'export' });
    }
  }
};

module.exports = reportController;
