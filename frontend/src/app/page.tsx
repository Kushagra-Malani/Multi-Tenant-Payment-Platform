'use client';

import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Container,
  Typography,
  Chip,
  Grid,
  CircularProgress,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function Home() {
  const router = useRouter();
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const res = await api.get('/tenants/public');
        setTenants(res.data);
      } catch (error) {
        console.error('Failed to fetch public tenants:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTenants();
  }, []);

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" component="h1" align="center" gutterBottom>
        Multi-Tenant Payment Platform
      </Typography>
      <Typography
        variant="subtitle1"
        align="center"
        color="text.secondary"
        sx={{ mb: 6 }}
      >
        Select a tenant to view their isolated dashboard
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={4}>
          {tenants.map((tenant) => (
            <Grid size={{ xs: 12, sm: 4 }} key={tenant.slug}>
              <Card sx={{ height: '100%' }}>
                <CardActionArea
                  sx={{ height: '100%', p: 2 }}
                  onClick={() => router.push(`/login?tenant=${tenant.slug}`)}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 2,
                      }}
                    >
                      <Typography variant="h5" component="h2">
                        {tenant.name}
                      </Typography>
                      <Chip
                        label={tenant.tier.toUpperCase()}
                        color={
                          tenant.tier === 'enterprise'
                            ? 'error'
                            : tenant.tier === 'professional'
                              ? 'primary'
                              : 'default'
                        }
                        size="small"
                      />
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      <strong>API Limit:</strong> {tenant.apiRateLimit} / min
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Max Txns:</strong>{' '}
                      {tenant.maxTransactions === -1
                        ? 'Unlimited'
                        : tenant.maxTransactions}{' '}
                      / month
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Box
        sx={{
          mt: 8,
          pt: 4,
          borderTop: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
        }}
      >
        <Typography variant="h6" gutterBottom>
          Platform Administration
        </Typography>
        <Card
          sx={{
            maxWidth: 400,
            mx: 'auto',
            bgcolor: 'grey.900',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <CardActionArea onClick={() => router.push('/login?tenant=platform')}>
            <CardContent>
              <Typography variant="h6">Super Admin Login</Typography>
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Manage tenants, users, and platform-wide configuration
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Box>
    </Container>
  );
}
