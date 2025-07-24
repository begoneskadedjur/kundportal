// src/components/admin/technicians/management/AbaxVehicleModal.tsx
import React, { useState, useEffect } from 'react';
import { Car, X, Copy, Check } from 'lucide-react';
import Button from '../../../ui/Button';
import LoadingSpinner from '../../../shared/LoadingSpinner';
import toast from 'react-hot-toast';

type Vehicle = {
  id: string;
  alias: string;
  license_plate: string;
  driver: string;
}

type AbaxVehicleModalProps = {
  isOpen: boolean;
  onClose: () => void;
}

export default function AbaxVehicleModal({ isOpen, onClose }: AbaxVehicleModalProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchVehicles = async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch('/api/ruttplanerare/get-abax-vehicles');
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.details || 'Kunde inte hämta fordonslista från Abax.');
          }
          setVehicles(data);
        } catch (err: any) {
          setError(err.message);
          toast.error(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchVehicles();
    }
  }, [isOpen]);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("Fordons-ID kopierat!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
      <div className="glass w-full max-w-4xl bg-slate-900/95 backdrop-blur-lg border border-slate-600 rounded-xl shadow-2xl flex flex-col">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center"><Car className="w-5 h-5 text-slate-300" /></div>
                <div>
                    <h2 className="text-xl font-semibold text-white">Abax Fordonslista</h2>
                    <p className="text-slate-400 text-sm">Lista över alla fordon registrerade i Abax.</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700 transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        
        <div className="p-6 flex-grow overflow-y-auto max-h-[70vh]">
          {loading && <div className="flex justify-center items-center h-48"><LoadingSpinner text="Hämtar fordon..." /></div>}
          {error && <div className="text-center text-red-400 p-8">{error}</div>}
          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
                  <tr>
                    <th scope="col" className="px-6 py-3">Alias</th>
                    <th scope="col" className="px-6 py-3">Reg. Nr.</th>
                    <th scope="col" className="px-6 py-3">Förare</th>
                    <th scope="col" className="px-6 py-3">Fordons-ID</th>
                    <th scope="col" className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="border-b border-slate-700 hover:bg-slate-800/40">
                      <td className="px-6 py-4 font-medium text-white">{vehicle.alias}</td>
                      <td className="px-6 py-4">{vehicle.license_plate}</td>
                      <td className="px-6 py-4">{vehicle.driver}</td>
                      <td className="px-6 py-4 font-mono text-slate-400">{vehicle.id}</td>
                      <td className="px-6 py-4">
                        <Button variant="ghost" size="sm" onClick={() => handleCopy(vehicle.id)}>
                          {copiedId === vehicle.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-slate-700 flex justify-end">
            <Button variant="secondary" onClick={onClose}>Stäng</Button>
        </div>
      </div>
    </div>
  );
}