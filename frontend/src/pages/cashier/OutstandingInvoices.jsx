import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip
} from '@mui/material';
import {
  PaymentsRounded as PayIcon,
  WarningAmberRounded as DeferredIcon,
  RefreshRounded as RefreshIcon,
  SearchRounded as SearchIcon
} from '@mui/icons-material';
import api from '../../services/api';
import InvoicePaymentDialog, { formatAmount, balanceOf } from '../../components/cashier/InvoicePaymentDialog';
import ConsultationReceipt from './ConsultationReceipt';

const TYPE_LABELS = {
  CONSULTATION: 'Consultation',
  EXAM: 'Examens',
  EMERGENCY: 'Urgences',
  BED: 'Hospitalisation',
  PROCEDURE: 'Acte',
  OTHER: 'Autre'
};

const daysSince = (date) =>
  Math.floor((Date.now() - new Date(date).getTime()) / (24 * 60 * 60 * 1000));

/**
 * Creances encore dues, toutes dates confondues.
 *
 * La file de la caisse ne montre que les consultations du jour : une creance
 * differee la veille en sortait le lendemain matin, et plus personne ne la
 * voyait. Une creance qu'on ne voit plus est une creance perdue.
 *
 * Le meme ecran sert au caissier, qui encaisse, et a l'administrateur, qui
 * surveille les prises en charge accordees sans reglement.
 */
const OutstandingInvoices = ({ canCollect = true, defaultFilter = 'ALL', title, subtitle }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(defaultFilter);
  const [selected, setSelected] = useState(null);
  const [receipt, setReceipt] = useState(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (filter === 'DEFERRED') params.set('deferred', 'true');

      const response = await api.get(`/invoices?${params}`);
      setInvoices(response.data.invoices || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Impossible de charger les créances');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Les plus anciennes d'abord : c'est l'ordre dans lequel une creance se
  // recupere, l'inverse de l'ordre d'affichage habituel.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return [...invoices]
      .filter((invoice) => {
        if (!term) return true;
        const patient = invoice.patient || {};
        return [patient.lastName, patient.firstName, patient.patientNumber, invoice.invoiceNumber]
          .some(value => value && String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [invoices, search]);

  const totalDue = rows.reduce((sum, invoice) => sum + balanceOf(invoice), 0);

  // Regulariser une creance est un encaissement comme un autre : le patient
  // repart avec la meme preuve de paiement que s'il avait regle au guichet.
  const handlePaid = ({ payment, invoice }) => {
    setReceipt({ payment, invoice: { ...selected, ...invoice } });
    setSelected(null);
    fetchInvoices();
  };

  if (receipt) {
    return (
      <ConsultationReceipt
        payment={receipt.payment}
        invoice={receipt.invoice}
        onNext={() => setReceipt(null)}
      />
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h6" fontWeight="bold">
            {title || 'Créances à régulariser'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle || `${rows.length} facture(s) — ${formatAmount(totalDue)} en attente de règlement`}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={filter}
            onChange={(e, value) => value && setFilter(value)}
          >
            <ToggleButton value="ALL" sx={{ textTransform: 'none', borderRadius: 2 }}>
              Toutes
            </ToggleButton>
            <ToggleButton value="DEFERRED" sx={{ textTransform: 'none', borderRadius: 2 }}>
              Soins délivrés sans règlement
            </ToggleButton>
          </ToggleButtonGroup>

          <TextField
            size="small"
            placeholder="Nom, n° patient, facture..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              )
            }}
            sx={{ width: 260, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Button startIcon={<RefreshIcon />} onClick={fetchInvoices} sx={{ borderRadius: 2, textTransform: 'none' }}>
            Actualiser
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Alert severity="success" sx={{ borderRadius: 2 }}>
          {filter === 'DEFERRED'
            ? 'Aucun soin délivré sans règlement en attente de régularisation.'
            : 'Aucune créance en cours.'}
        </Alert>
      ) : (
        <TableContainer sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Ancienneté</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Facture</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Patient</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Nature</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Motif</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Reste à payer</TableCell>
                {canCollect && <TableCell align="right" sx={{ fontWeight: 'bold' }}>Action</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((invoice) => {
                const patient = invoice.patient || {};
                const age = daysSince(invoice.createdAt);

                return (
                  <TableRow key={invoice.id} hover>
                    <TableCell>
                      {/* Une creance de plus d'une semaine ne se recupere plus
                          toute seule : elle doit se distinguer au premier coup d'oeil. */}
                      <Chip
                        label={age === 0 ? "Aujourd'hui" : `${age} j`}
                        size="small"
                        color={age >= 7 ? 'error' : age >= 2 ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">{invoice.invoiceNumber}</Typography>
                      {invoice.visit?.ticketNumber && (
                        <Typography variant="caption" color="text.secondary">
                          Ticket {String(invoice.visit.ticketNumber).padStart(3, '0')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {patient.lastName} {patient.firstName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {patient.patientNumber}{patient.phone ? ` · ${patient.phone}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={TYPE_LABELS[invoice.invoiceType] || invoice.invoiceType} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 240 }}>
                      {invoice.isDeferred ? (
                        <Tooltip title={invoice.deferredReason || ''} arrow>
                          <Chip icon={<DeferredIcon />} label="Soins délivrés" color="error" size="small" />
                        </Tooltip>
                      ) : invoice.status === 'PARTIALLY_PAID' ? (
                        <Chip label="Partiellement payé" color="warning" size="small" />
                      ) : (
                        <Typography variant="caption" color="text.secondary">En attente au guichet</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold">{formatAmount(balanceOf(invoice))}</Typography>
                    </TableCell>
                    {canCollect && (
                      <TableCell align="right">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<PayIcon />}
                          onClick={() => setSelected(invoice)}
                          sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
                        >
                          Encaisser
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <InvoicePaymentDialog
        invoice={selected}
        onClose={() => setSelected(null)}
        onPaid={handlePaid}
      />
    </Box>
  );
};

export default OutstandingInvoices;
