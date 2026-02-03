import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, UserPlus, Trash, X } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ActionButton from '@/components/ui/ActionButton';
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
import { getFilePublicUrl } from '@/lib/supabase';
import { error as logError } from '@/lib/logger';
import { normalizeForSearch } from '@/lib/stringUtils';
import type { Cliente } from '@/types/cliente';
import ClientAvatar from '@/components/clientes/ClientAvatar';
import WhatsAppLink from '@/components/ui/WhatsAppLink';
import { useAuth } from '@/contexts/AuthContext';
import { getProfilesByRole } from '@/lib/profiles';

export function ClientesView() {
  const { companyId, companyName } = useAuth();
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<string | null>(null);

  // Refs and measurement to compute a mobile-only fixed width based on placeholder
  const inputRef = useRef<HTMLInputElement | null>(null);
  const placeholderMeasureRef = useRef<HTMLSpanElement | null>(null);
  const [inputWidth, setInputWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      if (typeof window === 'undefined') return;
      const isMobile = window.matchMedia('(max-width: 640px)').matches;
      if (!isMobile) {
        setInputWidth(null);
        return;
      }
      const span = placeholderMeasureRef.current;
      if (!span) return;
      const placeholder = (document.getElementById('clientes-search') as HTMLInputElement)?.placeholder || 'Buscar clientes...';
      span.textContent = placeholder;
      // add padding compensation so placeholder is fully visible
      const width = Math.ceil(span.offsetWidth) + 32;
      setInputWidth(width);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Cargar clientes desde `profiles` (Supabase)
  useEffect(() => {
    const fetchClientes = async () => {
      if (!companyId) return;

      try {
        setLoading(true);
        setError(null);

        // Use RPC-backed helper that enforces column/row restrictions
        const records = await getProfilesByRole(companyId, 'client');

        const mapped = (records || []).map((r: any) => {
          const uid = r.user || r.user_id || r.id;
          return {
            id: uid,
            ...r,
            photoUrl:
              r.photoUrl ||
              (r.photo_path ? getFilePublicUrl('profile_photos', uid, r.photo_path) : null),
          };
        });
        setClientes(mapped);
        setFilteredClientes(mapped);
      } catch (err: any) {
        logError('Error al cargar clientes:', err);
        const errorMsg = err?.message || 'Error desconocido';
        setError(`Error al cargar los clientes: ${errorMsg}`);
      } finally {
        setLoading(false);
      }
    };

    fetchClientes();
  }, [companyId]);

  // Filtrar clientes cuando cambia la búsqueda
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredClientes(clientes);
    } else {
      const q = normalizeForSearch(searchQuery);

      const filtered = clientes.filter((cliente) => {
        const name = normalizeForSearch(String(cliente.name || ''));
        const last = normalizeForSearch(String(cliente.last_name || ''));
        const full = normalizeForSearch(`${cliente.name || ''} ${cliente.last_name || ''}`);
        const dni = normalizeForSearch(String(cliente.dni || ''));
        const phone = normalizeForSearch(String(cliente.phone || ''));
        const email = normalizeForSearch(String(cliente.email || ''));

        return (
          name.includes(q) ||
          last.includes(q) ||
          full.includes(q) ||
          dni.includes(q) ||
          phone.includes(q) ||
          email.includes(q)
        );
      });

      setFilteredClientes(filtered);
    }
  }, [searchQuery, clientes]);

  if (loading) {
    return <div className="p-4">Cargando...</div>;
  }

  const handleSort = () => {
    const sorted = [...filteredClientes].sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.name.localeCompare(b.name);
      } else {
        return b.name.localeCompare(a.name);
      }
    });
    setFilteredClientes(sorted);
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const handleAdd = () => {
    navigate(`/${companyName}/panel/cliente/nuevo`);
  };

  const handleRowClick = (cliente: Cliente) => {
    if (!cliente.id) return;
    navigate(`/${companyName}/panel/cliente/${cliente.id}`);
  };

  const handleDeleteClick = (id: string) => {
    setClienteToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!clienteToDelete) return;

    try {
      // Request server-side deletion: removes both the profile row and the linked auth user (service role) if present.
      const fetcher = await import('@/lib/supabase');
      const res = await fetcher.deleteUserByProfileId(clienteToDelete);
      if (!res || !res.ok) throw res?.data || res?.error || new Error('failed_to_delete_user');

      const updatedClientes = clientes.filter((c) => c.id !== clienteToDelete);
      setClientes(updatedClientes);
      setFilteredClientes(updatedClientes);
      setDeleteDialogOpen(false);
      setClienteToDelete(null);
    } catch (err: any) {
      logError('Error al eliminar cliente:', err);
      alert('Error al eliminar el cliente: ' + (err?.message || 'Error desconocido'));
    }
  };

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="clientes-search-wrap">
          <Input
            id="clientes-search"
            name="clientesSearch"
            placeholder="Buscar clientes..."
            className="section-search clientes-section-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            ref={inputRef}
            style={
              inputWidth
                ? ({ width: `${inputWidth}px`, flex: '0 0 auto' } as React.CSSProperties)
                : ({ flex: '1 1 auto' } as React.CSSProperties)
            }
          />

          {searchQuery ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Limpiar filtros"
              className="clientes-clear-btn"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : null}

          {/* Hidden element used to measure placeholder width */}
          <span ref={placeholderMeasureRef} className="measure-span" aria-hidden="true" />
        </div>

        <div className="flex-1" />
        <Button onClick={handleAdd}>
          <UserPlus className="mr-0 h-4 w-4" />
          Crear Cliente
        </Button>
      </div>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Foto</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={handleSort}
                  className="flex items-center gap-2 p-0 hover:bg-transparent"
                >
                  Nombre
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Actividad Física</TableHead>
              <TableHead>Clases Restantes</TableHead>
              <TableHead className="text-right pr-4">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClientes.map((cliente) => (
              <TableRow
                key={cliente.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(cliente)}
              >
                <TableCell>
                  <ClientAvatar cliente={cliente} />
                </TableCell>
                <TableCell className="font-medium">
                  {cliente.name} {cliente.last_name}
                </TableCell>
                <TableCell>{cliente.dni}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{cliente.phone}</span>
                    <WhatsAppLink profileId={cliente.id} message={''} className="ml-2" />
                  </div>
                </TableCell>
                <TableCell>{cliente.email}</TableCell>
                <TableCell>{cliente.sport || '-'}</TableCell>
                <TableCell>{cliente.class_credits || 0}</TableCell>
                <TableCell className="text-right pr-4">
                  <div className="flex justify-end gap-0.5">
                    <ActionButton
                      tooltip="Eliminar"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!cliente.id) return;
                        handleDeleteClick(cliente.id);
                      }}
                      aria-label="Eliminar cliente"
                    >
                      <Trash className="h-4 w-4" />
                    </ActionButton>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
