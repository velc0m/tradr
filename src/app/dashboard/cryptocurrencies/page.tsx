'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CreateCryptoModal } from '@/components/features/cryptocurrencies/CreateCryptoModal';
import { EditCryptoModal } from '@/components/features/cryptocurrencies/EditCryptoModal';
import { useToast } from '@/components/ui/use-toast';
import { ICryptocurrency } from '@/types';
import { Plus, Trash2, Edit, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CryptocurrenciesPage() {
  const { status } = useSession();
  const [cryptocurrencies, setCryptocurrencies] = useState<ICryptocurrency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [cryptoToEdit, setCryptoToEdit] = useState<ICryptocurrency | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cryptoToDelete, setCryptoToDelete] = useState<ICryptocurrency | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCryptocurrencies();
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    redirect('/auth/signin');
  }

  const fetchCryptocurrencies = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/cryptocurrencies');
      const data = await response.json();

      if (data.success && data.data) {
        setCryptocurrencies(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch cryptocurrencies');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to load cryptocurrencies',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCryptoCreated = (crypto: ICryptocurrency) => {
    setCryptocurrencies([...cryptocurrencies, crypto]);
  };

  const handleEditClick = (crypto: ICryptocurrency) => {
    setCryptoToEdit(crypto);
    setShowEditModal(true);
  };

  const handleCryptoUpdated = (updatedCrypto: ICryptocurrency) => {
    setCryptocurrencies(
      cryptocurrencies.map((c) =>
        c._id === updatedCrypto._id ? updatedCrypto : c
      )
    );
  };

  const handleDeleteClick = (crypto: ICryptocurrency) => {
    setCryptoToDelete(crypto);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!cryptoToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/cryptocurrencies/${cryptoToDelete._id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete cryptocurrency');
      }

      toast({
        title: 'Success',
        description: 'Cryptocurrency deleted successfully',
      });

      setCryptocurrencies(
        cryptocurrencies.filter((c) => c._id !== cryptoToDelete._id)
      );
      setDeleteDialogOpen(false);
      setCryptoToDelete(null);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to delete cryptocurrency',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">Manage Cryptocurrencies</h1>
              <p className="text-muted-foreground mt-1">
                View and manage your cryptocurrencies
              </p>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Cryptocurrency
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cryptocurrencies</CardTitle>
              <CardDescription>
                System cryptocurrencies and your custom additions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  Loading cryptocurrencies...
                </div>
              ) : cryptocurrencies.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No cryptocurrencies found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Decimal Places</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cryptocurrencies.map((crypto) => (
                      <TableRow key={crypto._id}>
                        <TableCell className="font-medium">
                          {crypto.symbol}
                        </TableCell>
                        <TableCell>{crypto.name}</TableCell>
                        <TableCell>{crypto.decimalPlaces}</TableCell>
                        <TableCell>
                          <span
                            className={
                              crypto.isDefault
                                ? 'text-xs bg-primary/10 text-primary px-2 py-1 rounded'
                                : 'text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded'
                            }
                          >
                            {crypto.isDefault ? 'System' : 'Custom'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {!crypto.isDefault && (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditClick(crypto)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(crypto)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <CreateCryptoModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleCryptoCreated}
      />

      {cryptoToEdit && (
        <EditCryptoModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          cryptocurrency={cryptoToEdit}
          onSuccess={handleCryptoUpdated}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the cryptocurrency{' '}
              <span className="font-semibold">{cryptoToDelete?.symbol}</span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
