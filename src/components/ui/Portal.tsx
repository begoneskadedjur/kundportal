// 📁 src/components/ui/Portal.tsx
// 🚪 Portal komponent för att rendera modaler utanför DOM-trädet

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
  containerId?: string;
}

const Portal: React.FC<PortalProps> = ({ children, containerId = 'modal-root' }) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Skapa eller hitta container
    let modalContainer = document.getElementById(containerId);
    
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = containerId;
      modalContainer.style.position = 'fixed';
      modalContainer.style.top = '0';
      modalContainer.style.left = '0';
      modalContainer.style.width = '100vw';        // FIX: Use vw instead of %
      modalContainer.style.height = '100vh';       // FIX: Use vh instead of %
      modalContainer.style.zIndex = '2147483647'; // Max z-index value
      modalContainer.style.pointerEvents = 'none'; // Låt klick passera genom
      modalContainer.style.display = 'flex';       // FIX: Establish flex context
      modalContainer.style.alignItems = 'center';  // FIX: Center alignment
      modalContainer.style.justifyContent = 'center';
      modalContainer.style.overflow = 'auto';      // FIX: Allow scrolling
      
      // Mobile-specific enhancements for technician field use
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        modalContainer.style.padding = '8px';
        modalContainer.style.alignItems = 'flex-start'; // Top alignment on mobile
        modalContainer.style.paddingTop = '20px';
      }
      
      document.body.appendChild(modalContainer);
    }
    
    setContainer(modalContainer);
    
    return () => {
      // Cleanup - ta bara bort om den är tom
      if (modalContainer && modalContainer.children.length === 0) {
        document.body.removeChild(modalContainer);
      }
    };
  }, [containerId]);

  if (!container) return null;

  return createPortal(children, container);
};

export default Portal;