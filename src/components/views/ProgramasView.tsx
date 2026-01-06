import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dumbbell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function ProgramasView() {
  const { user } = useAuth();

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4" />
            Programas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Aquí verás tus programas, {user?.name || 'cliente'}.
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 