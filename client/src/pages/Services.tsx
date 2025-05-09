import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
// Sidebar is now managed by App.tsx
import ServiceHealth from "@/components/dashboard/ServiceHealth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Globe, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServiceHealthData } from "@shared/schema";

export default function Services() {
  const { toast } = useToast();
  // We remove the search functionality entirely as it's no longer needed
  
  const { data: services, isLoading, refetch } = useQuery<ServiceHealthData[]>({
    queryKey: ['/api/services'],
  });
  
  // No filtering needed since we removed the search
  const filteredServices = useMemo(() => {
    if (!services || !Array.isArray(services)) return [];
    return services;
  }, [services]);
  
  const refreshData = () => {
    refetch();
    
    toast({
      title: "Services refreshed",
      description: "Service data has been updated",
    });
  };
  
  return (
    <div className="flex h-screen overflow-hidden bg-slate-900 text-slate-50">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-slate-800 border-b border-slate-700 shadow-sm sticky top-0 z-10">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex flex-col">
              <h1 className="text-xl font-semibold text-white">Services</h1>
              <p className="text-sm text-slate-400">Monitor service health and connectivity</p>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-slate-900 p-4">
          <div className="grid grid-cols-1 gap-6">
            {isLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <>
                <ServiceHealth services={filteredServices} />
                <div className="text-xs text-slate-500 mt-2">
                  Showing {filteredServices.length} of {services?.length || 0} services
                </div>
              </>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="bg-slate-800 border-slate-700 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Globe className="h-5 w-5 text-primary" />
                    <span>Ingress Services</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center py-8">
                  <div className="text-slate-400">
                    Ingress services details will be available in future releases
                  </div>
                  <Button variant="link" className="mt-4">
                    <ExternalLink className="h-4 w-4 mr-1" /> Learn More
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-800 border-slate-700 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <svg viewBox="0 0 24 24" width="20" height="20" className="mr-2 text-blue-500 fill-current">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span>Istio Services</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center py-8">
                  <div className="text-slate-400">
                    Service mesh details will be available in future releases
                  </div>
                  <Button variant="link" className="mt-4">
                    <ExternalLink className="h-4 w-4 mr-1" /> Learn More
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-800 border-slate-700 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <svg viewBox="0 0 24 24" width="20" height="20" className="mr-2 text-green-500 fill-current">
                      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                    </svg>
                    <span>Load Balancers</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center py-8">
                  <div className="text-slate-400">
                    Load balancer details will be available in future releases
                  </div>
                  <Button variant="link" className="mt-4">
                    <ExternalLink className="h-4 w-4 mr-1" /> Learn More
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}