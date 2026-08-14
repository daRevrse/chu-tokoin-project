import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  InputAdornment,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  SearchRounded as SearchIcon,
  AddRounded as AddIcon,
  VisibilityRounded as ViewIcon,
  EditRounded as EditIcon,
  PersonOffRounded as NoPatientIcon,
  ConfirmationNumberRounded as TicketIcon
} from '@mui/icons-material';
import api from '../../services/api';

/**
 * Recherche de patients, partagee entre l'accueil et le medecin.
 *
 * Les actions proposees sur chaque ligne dependent des callbacks fournis :
 * l'accueil passe `onOpenVisit` (ouvrir un passage), le medecin
 * `onCreatePrescription`.
 */
const PatientSearch = ({
  onSelectPatient,
  onCreatePrescription,
  onEditPatient,
  onOpenVisit,
  emptyHint
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      const response = await api.get(`/patients?q=${encodeURIComponent(searchTerm)}`);
      setPatients(response.data.patients || []);
      setSearched(true);
    } catch (error) {
      console.error('Erreur recherche patient:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const calculateAge = (dateOfBirth) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <TextField
          fullWidth
          placeholder="Nom, prénom, numéro patient ou téléphone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            )
          }}
          sx={{ flexGrow: 1, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }}
        />
        <Button
          variant="contained"
          onClick={handleSearch}
          disabled={loading || !searchTerm.trim()}
          sx={{ minWidth: 140, borderRadius: 2, textTransform: 'none', boxShadow: 'none', fontWeight: 'bold' }}
        >
          {loading ? 'Recherche...' : 'Rechercher'}
        </Button>
      </Box>

      {searched && (
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>N° Patient</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Nom Complet</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Âge</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Sexe</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Téléphone</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {patients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Box sx={{ py: 6 }}>
                      <NoPatientIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                      <Typography color="textSecondary">
                        Aucun patient trouvé
                      </Typography>
                      {emptyHint && (
                        <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                          {emptyHint}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                patients.map((patient) => (
                  <TableRow key={patient.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell>
                      <Chip label={patient.patientNumber} size="small" color="primary" variant="outlined" sx={{ fontWeight: 'bold' }} />
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="bold" variant="body2">
                        {patient.lastName} {patient.firstName}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{calculateAge(patient.dateOfBirth)} ans</TableCell>
                    <TableCell>
                      <Chip
                        label={patient.gender === 'M' ? 'Homme' : 'Femme'}
                        size="small"
                        color={patient.gender === 'M' ? 'info' : 'secondary'}
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{patient.phone}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Voir détails" arrow>
                        <IconButton
                          size="small"
                          onClick={() => onSelectPatient && onSelectPatient(patient)}
                          sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: '#e3f2fd' } }}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {onEditPatient && (
                        <Tooltip title="Modifier" arrow>
                          <IconButton
                            size="small"
                            onClick={() => onEditPatient(patient)}
                            sx={{ color: 'text.secondary', ml: 0.5, '&:hover': { color: 'info.main', bgcolor: '#e1f5fe' } }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {onCreatePrescription && (
                        <Tooltip title="Nouvelle prescription" arrow>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => onCreatePrescription(patient)}
                            sx={{ ml: 0.5, bgcolor: '#e3f2fd', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {onOpenVisit && (
                        <Tooltip title="Ouvrir un passage" arrow>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => onOpenVisit(patient)}
                            sx={{ ml: 0.5, bgcolor: '#e3f2fd', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                          >
                            <TicketIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default PatientSearch;