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
  Search as SearchIcon,
  Add as AddIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import api from '../../services/api';

const PatientSearch = ({ onSelectPatient, onCreatePrescription }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      const response = await api.get(`/patients?search=${encodeURIComponent(searchTerm)}`);
      setPatients(response.data.patients || []);
      setSearched(true);
    } catch (error) {
      console.error('Erreur recherche patient:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
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
      <Typography variant="h6" gutterBottom>
        Rechercher un Patient
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Nom, prenom, numero patient ou telephone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={handleKeyPress}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
        <Button
          variant="contained"
          onClick={handleSearch}
          disabled={loading || !searchTerm.trim()}
          sx={{ minWidth: 120 }}
        >
          {loading ? 'Recherche...' : 'Rechercher'}
        </Button>
      </Box>

      {searched && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>N° Patient</TableCell>
                <TableCell>Nom Complet</TableCell>
                <TableCell>Age</TableCell>
                <TableCell>Sexe</TableCell>
                <TableCell>Telephone</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {patients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="textSecondary" sx={{ py: 2 }}>
                      Aucun patient trouve
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                patients.map((patient) => (
                  <TableRow key={patient.id} hover>
                    <TableCell>
                      <Chip label={patient.patientNumber} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="medium">
                        {patient.lastName} {patient.firstName}
                      </Typography>
                    </TableCell>
                    <TableCell>{calculateAge(patient.dateOfBirth)} ans</TableCell>
                    <TableCell>
                      <Chip
                        label={patient.gender === 'M' ? 'Homme' : 'Femme'}
                        size="small"
                        color={patient.gender === 'M' ? 'info' : 'secondary'}
                      />
                    </TableCell>
                    <TableCell>{patient.phone}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Voir details">
                        <IconButton
                          size="small"
                          onClick={() => onSelectPatient && onSelectPatient(patient)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Nouvelle prescription">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => onCreatePrescription && onCreatePrescription(patient)}
                        >
                          <AddIcon />
                        </IconButton>
                      </Tooltip>
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
