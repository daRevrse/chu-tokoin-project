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
  Search as SearchIcon,
  Payment as PaymentIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Prescriptions en Attente de Paiement
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={fetchPendingPrescriptions}
          disabled={loading}
        >
          Actualiser
        </Button>
      </Box>

      <TextField
        fullWidth
        placeholder="Rechercher par numero, nom patient..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          )
        }}
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={50}></TableCell>
              <TableCell>N° Prescription</TableCell>
              <TableCell>Patient</TableCell>
              <TableCell>Medecin</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="right">Montant</TableCell>
              <TableCell align="center">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography sx={{ py: 3 }}>Chargement...</Typography>
                </TableCell>
              </TableRow>
            ) : filteredPrescriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="textSecondary" sx={{ py: 3 }}>
                    Aucune prescription en attente
                  </Typography>
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
                      >
                        {expandedRow === prescription.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={prescription.prescriptionNumber}
                        color="warning"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="medium">
                        {prescription.patient?.lastName} {prescription.patient?.firstName}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {prescription.patient?.patientNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      Dr. {prescription.doctor?.lastName}
                    </TableCell>
                    <TableCell>
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
                      >
                        Encaisser
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 0, borderBottom: expandedRow === prescription.id ? 1 : 0 }}>
                      <Collapse in={expandedRow === prescription.id} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 2, px: 4, bgcolor: 'grey.50' }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Examens prescrits:
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {prescription.prescriptionExams?.map((pe) => (
                              <Chip
                                key={pe.id}
                                label={`${pe.exam?.name} - ${formatPrice(pe.exam?.price)}`}
                                variant="outlined"
                                size="small"
                              />
                            ))}
                          </Box>
                          {prescription.notes && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Notes:
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
