"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Save, Plus, Trash2, GripVertical, Edit2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoadmapItem {
  month: number;
  title: string;
  description: string;
  category: string;
}

interface Priority {
  rank: number;
  area: string;
  description: string;
}

interface ReviewEditPlanProps {
  visionStatement: string;
  priorities: Priority[];
  roadmap: RoadmapItem[];
  onBack: () => void;
  onSave: (data: { vision: string; priorities: Priority[]; roadmap: RoadmapItem[] }) => void;
  isLoading: boolean;
}

export function ReviewEditPlan({
  visionStatement,
  priorities,
  roadmap,
  onBack,
  onSave,
  isLoading,
}: ReviewEditPlanProps) {
  const [editingSection, setEditingSection] = useState<"vision" | "priorities" | "roadmap" | null>(null);
  const [vision, setVision] = useState(visionStatement);
  const [editedPriorities, setEditedPriorities] = useState(priorities);
  const [editedRoadmap, setEditedRoadmap] = useState(roadmap);

  const handleSave = () => {
    onSave({ vision, priorities: editedPriorities, roadmap: editedRoadmap });
  };

  const movePriority = (index: number, direction: "up" | "down") => {
    const newPriorities = [...editedPriorities];
    if (direction === "up" && index > 0) {
      [newPriorities[index - 1], newPriorities[index]] = [newPriorities[index], newPriorities[index - 1]];
    } else if (direction === "down" && index < newPriorities.length - 1) {
      [newPriorities[index], newPriorities[index + 1]] = [newPriorities[index + 1], newPriorities[index]];
    }
    setEditedPriorities(newPriorities.map((p, i) => ({ ...p, rank: i + 1 })));
  };

  const updatePriority = (index: number, field: "area" | "description", value: string) => {
    const newPriorities = [...editedPriorities];
    newPriorities[index][field] = value;
    setEditedPriorities(newPriorities);
  };

  const removePriority = (index: number) => {
    setEditedPriorities(editedPriorities.filter((_, i) => i !== index).map((p, i) => ({ ...p, rank: i + 1 })));
  };

  const addRoadmapItem = () => {
    setEditedRoadmap([
      ...editedRoadmap,
      { month: 3, title: "", description: "", category: "logistical" },
    ]);
  };

  const updateRoadmapItem = (index: number, field: keyof RoadmapItem, value: string | number) => {
    const newRoadmap = [...editedRoadmap];
    (newRoadmap[index] as any)[field] = value;
    setEditedRoadmap(newRoadmap);
  };

  const removeRoadmapItem = (index: number) => {
    setEditedRoadmap(editedRoadmap.filter((_, i) => i !== index));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "financial":
        return "text-emerald-600";
      case "experience":
        return "text-blue-600";
      case "logistical":
        return "text-amber-600";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      {/* Header */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Review your plan below. You can edit any section before saving.
        </p>
      </div>

      {/* Vision Statement */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Shared Vision</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingSection(editingSection === "vision" ? null : "vision")}
          >
            {editingSection === "vision" ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
          </Button>
        </div>
        {editingSection === "vision" ? (
          <Textarea
            value={vision}
            onChange={(e) => setVision(e.target.value)}
            rows={3}
            className="resize-none"
          />
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">{vision}</p>
        )}
      </div>

      {/* Priorities */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Your Priorities</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingSection(editingSection === "priorities" ? null : "priorities")}
          >
            {editingSection === "priorities" ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
          </Button>
        </div>
        <div className="space-y-2">
          {editedPriorities.map((priority, index) => (
            <div key={index} className="flex items-start gap-2 group">
              {editingSection === "priorities" && (
                <div className="flex flex-col gap-1 mt-1">
                  <button
                    onClick={() => movePriority(index, "up")}
                    disabled={index === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => movePriority(index, "down")}
                    disabled={index === editedPriorities.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
              )}
              <span className="text-xs font-bold text-muted-foreground w-6 mt-1">
                {priority.rank}
              </span>
              <div className="flex-1">
                {editingSection === "priorities" ? (
                  <div className="space-y-1">
                    <Input
                      value={priority.area}
                      onChange={(e) => updatePriority(index, "area", e.target.value)}
                      placeholder="Area"
                      className="h-7 text-sm"
                    />
                    <Input
                      value={priority.description}
                      onChange={(e) => updatePriority(index, "description", e.target.value)}
                      placeholder="Description"
                      className="h-7 text-xs"
                    />
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium">{priority.area}</p>
                    <p className="text-xs text-muted-foreground">{priority.description}</p>
                  </>
                )}
              </div>
              {editingSection === "priorities" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removePriority(index)}
                  className="opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">12-Month Roadmap</h3>
          <div className="flex gap-2">
            {editingSection === "roadmap" && (
              <Button variant="ghost" size="sm" onClick={addRoadmapItem}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingSection(editingSection === "roadmap" ? null : "roadmap")}
            >
              {editingSection === "roadmap" ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {editedRoadmap.map((item, index) => (
            <div
              key={index}
              className={cn(
                "flex gap-3 items-start p-3 rounded-lg border",
                editingSection === "roadmap" && "bg-secondary/30"
              )}
            >
              {editingSection === "roadmap" ? (
                <>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={item.month}
                    onChange={(e) => updateRoadmapItem(index, "month", parseInt(e.target.value) || 1)}
                    className="w-16 h-8 text-xs"
                  />
                  <div className="flex-1 space-y-2">
                    <Input
                      value={item.title}
                      onChange={(e) => updateRoadmapItem(index, "title", e.target.value)}
                      placeholder="Title"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={item.description}
                      onChange={(e) => updateRoadmapItem(index, "description", e.target.value)}
                      placeholder="Description"
                      className="h-8 text-xs"
                    />
                    <select
                      value={item.category}
                      onChange={(e) => updateRoadmapItem(index, "category", e.target.value)}
                      className="h-7 text-xs rounded-md border border-input bg-background px-2"
                    >
                      <option value="financial">Financial</option>
                      <option value="experience">Experience</option>
                      <option value="logistical">Logistical</option>
                    </select>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRoadmapItem(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {item.month === 1 ? "This month" : `Month ${item.month}`}
                    </p>
                    <p className={cn("text-sm font-medium", getCategoryColor(item.category))}>
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        <Button onClick={handleSave} disabled={isLoading} size="sm" className="gap-1">
          {isLoading ? "Saving…" : "Save our plan"}
          <Save className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
