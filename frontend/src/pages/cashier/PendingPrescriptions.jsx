import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Collapse
} from '@mui/material';
import {
  SearchRounded as SearchIcon,
  PaymentRounded as PaymentIcon,
  ExpandMoreRounded as ExpandMoreIcon,
  ExpandLessRounded as ExpandLessIcon,
  RefreshRounded as RefreshIcon,
  InboxRounded as EmptyIcon
} from '@mui/icons-material';
import api from '../../services/api';

const PendingPrescriptions = ({ onSelectPrescription }) => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [filteredPrescriptions, setFilteredPrescriptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    fetchPendingPrescriptions();
  }, []);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = prescriptions.filter(p =>
        p.prescriptionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.patient?.patientNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.patient?.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.patient?.firstName.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPrescriptions(filtered);
    } else {
      setFilteredPrescriptions(prescriptions);
    }
  }, [searchTerm, prescriptions]);

  const fetchPendingPrescriptions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/prescriptions/pending');
      setPrescriptions(response.data.prescriptions || []);
    } catch (error) {
      console.error('Erreur chargement prescriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleExpand = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6" fontWeight="bold">
          Prescriptions en Attente de Paiement
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={fetchPendingPrescriptions}
          disabled={loading}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', color: 'text.secondary' }}
        >
          Actualiser
        </Button>
      </Box>

      <TextField
        fullWidth
        placeholder="Rechercher par numéro, nom patient..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          )
        }}
      />

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell width={50} />
              <TableCell sx={{ fontWeight: 'bold' }}>N° Prescription</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Patient</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Médecin</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Montant</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="textSecondary" sx={{ py: 6 }}>Chargement...</Typography>
                </TableCell>
              </TableRow>
            ) : filteredPrescriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Box sx={{ py: 6 }}>
                    <EmptyIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                    <Typography color="textSecondary">
                      Aucune prescription en attente
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              filteredPrescriptions.map((prescription) => (
                <React.Fragment key={prescription.id}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => toggleExpand(prescription.id)}
                        sx={{ color: 'text.secondary', '&:hover': { bgcolor: '#f5f7fb' } }}
                      >
                        {expandedRow === prescription.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={prescription.prescriptionNumber}
                        color="warning"
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="bold" variant="body2">
                        {prescription.patient?.lastName} {prescription.patient?.firstName}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {prescription.patient?.patientNumber}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      Dr. {prescription.doctor?.lastName}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {formatDate(prescription.createdAt)}
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold" color="primary">
                        {formatPrice(prescription.totalAmount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<PaymentIcon />}
                        onClick={() => onSelectPrescription(prescription)}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none' }}
                      >
                        Encaisser
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 0, borderBottom: expandedRow === prescription.id ? 1 : 0 }}>
                      <Collapse in={expandedRow === prescription.id} timeout="auto" unmountOnExit>
                        <Box sx={{ my: 2, p: 3, bgcolor: '#f8fafc', borderRadius: 3 }}>
                          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                            Examens prescrits
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {prescription.prescriptionExams?.map((pe) => (
                              <Chip
                                key={pe.id}
                                label={`${pe.exam?.name} — ${formatPrice(pe.exam?.price)}`}
                                variant="outlined"
                                size="small"
                                sx={{ bgcolor: 'white', fontWeight: 'medium' }}
                              />
                            ))}
                          </Box>
                          {prescription.notes && (
                            <Box sx={{ mt: 3 }}>
                              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                Notes
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                {prescription.notes}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default PendingPrescriptions;
