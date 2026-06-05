import { MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LocationPermissionModalProps {
  isOpen: boolean;
  onAllow: () => void;
  onDeny: () => void;
}

export function LocationPermissionModal({ isOpen, onAllow, onDeny }: LocationPermissionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-3xl max-w-sm w-full p-6 animate-scale-in shadow-xl">
        <div className="text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-10 h-10 text-primary" />
          </div>
          
          <h2 className="text-xl font-bold mb-2">Enable Location</h2>
          <p className="text-muted-foreground mb-6">
            Allow Pilnak to access your location to find nearby drivers and provide accurate delivery tracking.
          </p>

          <div className="space-y-3">
            <Button 
              onClick={onAllow} 
              className="w-full"
              size="lg"
            >
              Allow Location Access
            </Button>
            <Button 
              onClick={onDeny} 
              variant="ghost"
              className="w-full"
            >
              Not Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
