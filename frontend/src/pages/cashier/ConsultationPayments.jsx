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
  InputAdornment
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

const POLL_INTERVAL_MS = 15000;

/**
 * Frais de consultation a encaisser dans la journee.
 *
 * C'est la file de travail de la caisse cote consultations : les patients
 * enregistres a l'accueil qui attendent devant le guichet avant de pouvoir etre
 * appeles par le medecin.
 */
const ConsultationPayments = ({ onPaymentRecorded }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [receipt, setReceipt] = useState(null);

  const fetchInvoices = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    try {
      const response = await api.get('/invoices/consultations/today');
      setInvoices(response.data.invoices || []);
      setError('');
    } catch (err) {
      console.error('Erreur chargement consultations:', err);
      setError(err.response?.data?.error || 'Impossible de charger les consultations à encaisser');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();

    // Meme cadence que la file d'attente de l'accueil : les deux ecrans suivent
    // les memes patients, a une etape d'ecart.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchInvoices({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchInvoices]);

  // Filtrage cote client : la liste tient dans une journee, et le caissier a un
  // patient devant lui — un aller-retour serveur a chaque frappe le ferait
  // attendre pour rien.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return invoices;

    return invoices.filter((invoice) => {
      const patient = invoice.patient || {};
      const ticket = invoice.visit?.ticketNumber;

      return [
        patient.lastName,
        patient.firstName,
        patient.patientNumber,
        patient.phone,
        invoice.invoiceNumber,
        ticket ? String(ticket) : null,
        // Le caissier lit le numero imprime sur le ticket, zeros compris.
        ticket ? String(ticket).padStart(3, '0') : null
      ].some(value => value && String(value).toLowerCase().includes(term));
    });
  }, [invoices, search]);

  const handlePaid = ({ payment, invoice }) => {
    // Les totaux viennent de la reponse, le patient et le passage de la liste :
    // la facture renvoyee par l'encaissement ne porte pas ses associations.
    setReceipt({ payment, invoice: { ...selected, ...invoice } });
    setSelected(null);
    fetchInvoices({ silent: true });
    if (onPaymentRecorded) onPaymentRecorded();
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const totalDue = invoices.reduce((sum, invoice) => sum + balanceOf(invoice), 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h6" fontWeight="bold">
            Consultations à encaisser
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {invoices.length} patient(s) — {formatAmount(totalDue)} à percevoir
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="N° ticket, nom, n° patient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              )
            }}
            sx={{ width: 280, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => fetchInvoices()}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Actualiser
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {invoices.length === 0 ? (
        <Alert severity="success" sx={{ borderRadius: 2 }}>
          Aucune consultation en attente de règlement.
        </Alert>
      ) : filtered.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Aucun patient ne correspond à « {search} ».
        </Alert>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Ticket</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Spécialité</TableCell>
                <TableCell align="right">Montant</TableCell>
                <TableCell align="right">Reste à payer</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((invoice) => {
                const visit = invoice.visit || {};
                const patient = invoice.patient || {};

                return (
                  <TableRow key={invoice.id} hover>
                    <TableCell>
                      <Typography fontWeight="bold">
                        {visit.ticketNumber ? String(visit.ticketNumber).padStart(3, '0') : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {patient.lastName} {patient.firstName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {patient.patientNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {visit.specialty ? (
                        <Chip
                          label={visit.specialty.name}
                          size="small"
                          variant="outlined"
                          sx={{ borderColor: visit.specialty.color || undefined }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">Non orienté</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{formatAmount(invoice.totalAmount)}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold">{formatAmount(balanceOf(invoice))}</Typography>
                    </TableCell>
                    <TableCell>
                      {invoice.isDeferred ? (
                        <Chip icon={<DeferredIcon />} label="À régulariser" color="error" size="small" />
                      ) : invoice.status === 'PARTIALLY_PAID' ? (
                        <Chip label="Partiellement payé" color="warning" size="small" />
                      ) : (
                        <Chip label="À encaisser" size="small" variant="outlined" />
                      )}
                    </TableCell>
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

export default ConsultationPayments;
