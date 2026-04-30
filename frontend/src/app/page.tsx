'use client';

import { Box, Card, CardActionArea, CardContent, Container, Typography, Chip, Grid } from '@mui/material';
import { useRouter } from 'next/navigation';

const tenants = [
  {
    slug: 'bank1',
    name: 'Bank One',
    tier: 'starter',
    apiRateLimit: 60,
    maxTransactions: 1000,
  },
  {
    slug: 'hdfc',
    name: 'HDFC Bank',
    tier: 'professional',
    apiRateLimit: 300,
    maxTransactions: 50000,
  },
  {
    slug: 'enterprise-bank',
    name: 'Enterprise Bank',
    tier: 'enterprise',
    apiRateLimit: 1000,
    maxTransactions: 'Unlimited',
  },
];

export default function Home() {
  const router = useRouter();

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" component="h1" align="center" gutterBottom>
        Multi-Tenant Payment Platform
      </Typography>
      <Typography variant="subtitle1" align="center" color="text.secondary" sx={{ mb: 6 }}>
        Select a tenant to view their isolated dashboard
      </Typography>

      <Grid container spacing={4}>
        {tenants.map((tenant) => (
          <Grid item xs={12} sm={4} key={tenant.slug}>
            <Card sx={{ height: '100%' }}>
              <CardActionArea 
                sx={{ height: '100%', p: 2 }}
                onClick={() => router.push(`/dashboard?tenant=${tenant.slug}`)}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h5" component="h2">
                      {tenant.name}
                    </Typography>
                    <Chip 
                      label={tenant.tier.toUpperCase()} 
                      color={
                        tenant.tier === 'enterprise' ? 'error' : 
                        tenant.tier === 'professional' ? 'primary' : 'default'
                      }
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>API Limit:</strong> {tenant.apiRateLimit} / min
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Max Txns:</strong> {tenant.maxTransactions} / month
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
