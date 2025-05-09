import { ArrowUp } from "lucide-react";
import { ServerIcon, HardDriveIcon, BoxesIcon, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { OverviewStatsData } from "@shared/schema";

interface OverviewStatsProps {
  stats: OverviewStatsData;
}

interface DetailItem {
  label: string;
  value: number;
  color?: string;
}

export default function OverviewStats({ stats }: OverviewStatsProps) {
  interface CardType {
    title: string;
    value: number;
    change: number;
    icon: React.ElementType;
    details?: DetailItem[];
    progress?: {
      percentage: number;
      label1: string;
      label2: string;
    };
  }
  
  const cards: CardType[] = [
    {
      title: "Total Clusters",
      value: stats.totalClusters,
      change: stats.clustersChange,
      icon: ServerIcon,
      details: [
        { label: "GKE", value: stats.gkeClusters },
        { label: "AKS", value: stats.aksClusters },
        { label: "EKS", value: stats.eksClusters }
      ]
    },
    {
      title: "Total Nodes",
      value: stats.totalNodes,
      change: stats.nodesChange,
      icon: HardDriveIcon,
      progress: {
        percentage: 65,
        label1: "65% Utilized",
        label2: "35% Available"
      }
    },
    {
      title: "Total Pods",
      value: stats.totalPods,
      change: stats.podsChange,
      icon: BoxesIcon,
      details: [
        { label: "Running", value: stats.runningPods, color: "text-success" },
        { label: "Pending", value: stats.pendingPods, color: "text-warning" },
        { label: "Failed", value: stats.failedPods, color: "text-error" }
      ]
    },
    {
      title: "Namespaces",
      value: stats.totalNamespaces,
      change: stats.namespacesChange,
      icon: Layers,
      details: [
        { label: "System", value: stats.systemNamespaces },
        { label: "User", value: stats.userNamespaces }
      ]
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => (
        <Card key={index} className="transition-transform hover:scale-[1.02] bg-slate-800 shadow-lg border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-400">{card.title}</h3>
              <card.icon className="h-5 w-5 text-white" />
            </div>
            <div className="mt-2 flex items-baseline">
              <p className="text-2xl font-semibold text-white">{card.value.toLocaleString()}</p>
              {card.change > 0 && (
                <p className="ml-2 text-sm text-green-400 font-medium flex items-center">
                  <ArrowUp className="h-3 w-3 mr-1" />
                  <span>+{card.change}</span>
                </p>
              )}
            </div>
            
            {card.progress && (
              <div className="mt-1">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="bg-info h-full rounded-full" style={{ width: `${card.progress.percentage}%` }}></div>
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>{card.progress.label1}</span>
                  <span>{card.progress.label2}</span>
                </div>
              </div>
            )}
            
            {card.details && (
              <div className="mt-1">
                <div className="flex justify-between text-xs text-slate-400">
                  {card.details.map((detail, i) => (
                    <span key={i}>
                      {detail.label}: <span className={(detail as DetailItem).color || "text-white"}>{detail.value.toLocaleString()}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
