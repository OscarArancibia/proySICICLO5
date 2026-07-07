"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Save,
  FileText,
  BookOpen,
  Users,
  ClipboardList,
  Calculator,
  Info,
  Plus,
  Trash2,
  Edit,
  ChevronDown,
  ChevronRight,
  Eye,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Tipos
interface SubPunto {
  id: number;
  nombre: string;
  nota: number | null;
}

interface Dimension {
  nombre: string;
  porcentaje: number;
  subPuntos: SubPunto[];
  promedio: number | null;
}

interface StudentGrade {
  id: number;
  name: string;
  ci: string;
  dimensiones: {
    ser: Dimension;
    saber: Dimension;
    hacer: Dimension;
    autoevaluacion: Dimension;
  };
  total: number | null;
}

// Datos de ejemplo
const initialStudents: StudentGrade[] = [
  {
    id: 1,
    name: "María García López",
    ci: "12345678",
    dimensiones: {
      ser: {
        nombre: "Ser",
        porcentaje: 10,
        subPuntos: [
          { id: 1, nombre: "Puntualidad", nota: 90 },
          { id: 2, nombre: "Respeto", nota: 85 },
          { id: 3, nombre: "Participación", nota: 80 },
        ],
        promedio: 85,
      },
      saber: {
        nombre: "Saber",
        porcentaje: 45,
        subPuntos: [
          { id: 1, nombre: "Examen Parcial 1", nota: 75 },
          { id: 2, nombre: "Examen Parcial 2", nota: 80 },
          { id: 3, nombre: "Examen Final", nota: 78 },
        ],
        promedio: 78,
      },
      hacer: {
        nombre: "Hacer",
        porcentaje: 40,
        subPuntos: [
          { id: 1, nombre: "Tarea 1", nota: 85 },
          { id: 2, nombre: "Proyecto", nota: 80 },
          { id: 3, nombre: "Práctica", nota: 82 },
        ],
        promedio: 82,
      },
      autoevaluacion: {
        nombre: "Autoevaluación",
        porcentaje: 5,
        subPuntos: [{ id: 1, nombre: "Autoevaluación Trimestral", nota: 90 }],
        promedio: 90,
      },
    },
    total: null,
  },
  {
    id: 2,
    name: "Juan Pérez Mamani",
    ci: "23456789",
    dimensiones: {
      ser: {
        nombre: "Ser",
        porcentaje: 10,
        subPuntos: [
          { id: 1, nombre: "Puntualidad", nota: 95 },
          { id: 2, nombre: "Respeto", nota: 90 },
          { id: 3, nombre: "Participación", nota: 85 },
        ],
        promedio: 90,
      },
      saber: {
        nombre: "Saber",
        porcentaje: 45,
        subPuntos: [
          { id: 1, nombre: "Examen Parcial 1", nota: 88 },
          { id: 2, nombre: "Examen Parcial 2", nota: 85 },
          { id: 3, nombre: "Examen Final", nota: 82 },
        ],
        promedio: 85,
      },
      hacer: {
        nombre: "Hacer",
        porcentaje: 40,
        subPuntos: [
          { id: 1, nombre: "Tarea 1", nota: 90 },
          { id: 2, nombre: "Proyecto", nota: 88 },
          { id: 3, nombre: "Práctica", nota: 85 },
        ],
        promedio: 88,
      },
      autoevaluacion: {
        nombre: "Autoevaluación",
        porcentaje: 5,
        subPuntos: [{ id: 1, nombre: "Autoevaluación Trimestral", nota: 95 }],
        promedio: 95,
      },
    },
    total: null,
  },
  {
    id: 3,
    name: "Sofía Rodríguez Quispe",
    ci: "34567890",
    dimensiones: {
      ser: {
        nombre: "Ser",
        porcentaje: 10,
        subPuntos: [
          { id: 1, nombre: "Puntualidad", nota: 70 },
          { id: 2, nombre: "Respeto", nota: 75 },
          { id: 3, nombre: "Participación", nota: 80 },
        ],
        promedio: 75,
      },
      saber: {
        nombre: "Saber",
        porcentaje: 45,
        subPuntos: [
          { id: 1, nombre: "Examen Parcial 1", nota: 68 },
          { id: 2, nombre: "Examen Parcial 2", nota: 72 },
          { id: 3, nombre: "Examen Final", nota: 70 },
        ],
        promedio: 70,
      },
      hacer: {
        nombre: "Hacer",
        porcentaje: 40,
        subPuntos: [
          { id: 1, nombre: "Tarea 1", nota: 75 },
          { id: 2, nombre: "Proyecto", nota: 70 },
          { id: 3, nombre: "Práctica", nota: 72 },
        ],
        promedio: 72,
      },
      autoevaluacion: {
        nombre: "Autoevaluación",
        porcentaje: 5,
        subPuntos: [{ id: 1, nombre: "Autoevaluación Trimestral", nota: 80 }],
        promedio: 80,
      },
    },
    total: null,
  },
  {
    id: 4,
    name: "Carlos Mendoza Flores",
    ci: "45678901",
    dimensiones: {
      ser: {
        nombre: "Ser",
        porcentaje: 10,
        subPuntos: [],
        promedio: null,
      },
      saber: {
        nombre: "Saber",
        porcentaje: 45,
        subPuntos: [],
        promedio: null,
      },
      hacer: {
        nombre: "Hacer",
        porcentaje: 40,
        subPuntos: [],
        promedio: null,
      },
      autoevaluacion: {
        nombre: "Autoevaluación",
        porcentaje: 5,
        subPuntos: [],
        promedio: null,
      },
    },
    total: null,
  },
  {
    id: 5,
    name: "Ana Martínez Choque",
    ci: "56789012",
    dimensiones: {
      ser: {
        nombre: "Ser",
        porcentaje: 10,
        subPuntos: [
          { id: 1, nombre: "Puntualidad", nota: 100 },
          { id: 2, nombre: "Respeto", nota: 95 },
          { id: 3, nombre: "Participación", nota: 90 },
        ],
        promedio: 95,
      },
      saber: {
        nombre: "Saber",
        porcentaje: 45,
        subPuntos: [
          { id: 1, nombre: "Examen Parcial 1", nota: 95 },
          { id: 2, nombre: "Examen Parcial 2", nota: 92 },
          { id: 3, nombre: "Examen Final", nota: 90 },
        ],
        promedio: 92,
      },
      hacer: {
        nombre: "Hacer",
        porcentaje: 40,
        subPuntos: [
          { id: 1, nombre: "Tarea 1", nota: 92 },
          { id: 2, nombre: "Proyecto", nota: 88 },
          { id: 3, nombre: "Práctica", nota: 90 },
        ],
        promedio: 90,
      },
      autoevaluacion: {
        nombre: "Autoevaluación",
        porcentaje: 5,
        subPuntos: [{ id: 1, nombre: "Autoevaluación Trimestral", nota: 100 }],
        promedio: 100,
      },
    },
    total: null,
  },
];

// Calcula el promedio ponderado según el sistema boliviano
function calculateTotal(student: StudentGrade): number | null {
  const { ser, saber, hacer, autoevaluacion } = student.dimensiones;
  if (
    ser.promedio === null ||
    saber.promedio === null ||
    hacer.promedio === null ||
    autoevaluacion.promedio === null
  ) {
    return null;
  }
  return Math.round(
    ser.promedio * 0.1 +
      saber.promedio * 0.45 +
      hacer.promedio * 0.4 +
      autoevaluacion.promedio * 0.05,
  );
}

function getGradeColor(grade: number | null): string {
  if (grade === null) return "text-muted-foreground";
  if (grade >= 90) return "text-success";
  if (grade >= 70) return "text-primary";
  if (grade >= 51) return "text-amber-500";
  return "text-destructive";
}

function getGradeBadge(grade: number | null) {
  if (grade === null)
    return { label: "Sin nota", variant: "secondary" as const };
  if (grade >= 90) return { label: "Excelente", variant: "default" as const };
  if (grade >= 70) return { label: "Bueno", variant: "secondary" as const };
  if (grade >= 51) return { label: "Suficiente", variant: "outline" as const };
  return { label: "Insuficiente", variant: "destructive" as const };
}

export default function CalificacionesPage() {
  const [students, setStudents] = useState(initialStudents);
  const [selectedGrade, setSelectedGrade] = useState("3A");
  const [selectedSubject, setSelectedSubject] = useState("matematicas");
  const [selectedTrimester, setSelectedTrimester] = useState("1");
  const [expandedStudent, setExpandedStudent] = useState<number | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentGrade | null>(
    null,
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSubPunto, setNewSubPunto] = useState({
    nombre: "",
    dimension: "ser",
  });

  const studentsWithTotal = students.map((student) => ({
    ...student,
    total: calculateTotal(student),
  }));

  const averageTotal =
    studentsWithTotal.filter((s) => s.total !== null).length > 0
      ? Math.round(
          studentsWithTotal
            .filter((s) => s.total !== null)
            .reduce((acc, s) => acc + (s.total || 0), 0) /
            studentsWithTotal.filter((s) => s.total !== null).length,
        )
      : 0;

  const studentsWithGrades = studentsWithTotal.filter(
    (s) => s.total !== null,
  ).length;
  const totalStudents = studentsWithTotal.length;

  const handleGradeChange = (
    studentId: number,
    dimension: keyof StudentGrade["dimensiones"],
    subPuntoId: number,
    value: string,
  ) => {
    const numValue =
      value === "" ? null : Math.min(100, Math.max(0, parseInt(value)));

    setStudents((prev) =>
      prev.map((student) => {
        if (student.id !== studentId) return student;

        const updatedDimension = {
          ...student.dimensiones[dimension],
          subPuntos: student.dimensiones[dimension].subPuntos.map((sp) =>
            sp.id === subPuntoId ? { ...sp, nota: numValue } : sp,
          ),
        };

        // Recalcular promedio de la dimensión
        const notasValidas = updatedDimension.subPuntos.filter(
          (sp) => sp.nota !== null,
        );
        updatedDimension.promedio =
          notasValidas.length > 0
            ? Math.round(
                notasValidas.reduce((acc, sp) => acc + (sp.nota || 0), 0) /
                  notasValidas.length,
              )
            : null;

        return {
          ...student,
          dimensiones: {
            ...student.dimensiones,
            [dimension]: updatedDimension,
          },
        };
      }),
    );
  };

  const handleAddSubPunto = (dimension: keyof StudentGrade["dimensiones"]) => {
    if (!newSubPunto.nombre.trim()) return;

    setStudents((prev) =>
      prev.map((student) => ({
        ...student,
        dimensiones: {
          ...student.dimensiones,
          [dimension]: {
            ...student.dimensiones[dimension],
            subPuntos: [
              ...student.dimensiones[dimension].subPuntos,
              {
                id: Date.now(),
                nombre: newSubPunto.nombre,
                nota: null,
              },
            ],
          },
        },
      })),
    );
    setNewSubPunto({ nombre: "", dimension: "ser" });
    setIsDialogOpen(false);
  };

  const handleRemoveSubPunto = (
    dimension: keyof StudentGrade["dimensiones"],
    subPuntoId: number,
  ) => {
    setStudents((prev) =>
      prev.map((student) => {
        const updatedDimension = {
          ...student.dimensiones[dimension],
          subPuntos: student.dimensiones[dimension].subPuntos.filter(
            (sp) => sp.id !== subPuntoId,
          ),
        };

        // Recalcular promedio
        const notasValidas = updatedDimension.subPuntos.filter(
          (sp) => sp.nota !== null,
        );
        updatedDimension.promedio =
          notasValidas.length > 0
            ? Math.round(
                notasValidas.reduce((acc, sp) => acc + (sp.nota || 0), 0) /
                  notasValidas.length,
              )
            : null;

        return {
          ...student,
          dimensiones: {
            ...student.dimensiones,
            [dimension]: updatedDimension,
          },
        };
      }),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Registro de Calificaciones
          </h1>
          <p className="text-muted-foreground">
            Sistema de evaluación boliviano con sub-puntos por dimensión
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Reporte
          </Button>
          <Button className="gap-2">
            <Save className="h-4 w-4" />
            Guardar
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-primary">
                Sistema de Calificación Boliviano
              </p>
              <p className="text-muted-foreground mt-1">
                Cada dimensión puede tener múltiples sub-puntos. El promedio de
                los sub-puntos determina la nota de cada dimensión.
              </p>
              <div className="flex flex-wrap gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-primary/20" />
                  <strong>Ser (10%):</strong> Actitudes
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-success/20" />
                  <strong>Saber (45%):</strong> Conocimientos
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-amber-500/20" />
                  <strong>Hacer (40%):</strong> Práctica
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-info/20" />
                  <strong>Auto (5%):</strong> Autoevaluación
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-0">
              <label className="text-sm font-medium mb-2 block">Curso</label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar curso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PK-A">Pre-Kinder A</SelectItem>
                  <SelectItem value="PK-B">Pre-Kinder B</SelectItem>
                  <SelectItem value="K-A">Kinder A</SelectItem>
                  <SelectItem value="K-B">Kinder B</SelectItem>
                  <SelectItem value="1A">1ro Primaria A</SelectItem>
                  <SelectItem value="2A">2do Primaria A</SelectItem>
                  <SelectItem value="3A">3ro Primaria A</SelectItem>
                  <SelectItem value="4A">4to Primaria A</SelectItem>
                  <SelectItem value="5A">5to Primaria A</SelectItem>
                  <SelectItem value="6A">6to Primaria A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-sm font-medium mb-2 block">Materia</label>
              <Select
                value={selectedSubject}
                onValueChange={setSelectedSubject}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar materia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="matematicas">Matemáticas</SelectItem>
                  <SelectItem value="lenguaje">Lenguaje</SelectItem>
                  <SelectItem value="ciencias">Ciencias Naturales</SelectItem>
                  <SelectItem value="sociales">Ciencias Sociales</SelectItem>
                  <SelectItem value="ingles">Inglés</SelectItem>
                  <SelectItem value="educacion_fisica">
                    Educación Física
                  </SelectItem>
                  <SelectItem value="artes">Artes Plásticas</SelectItem>
                  <SelectItem value="musica">Música</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-sm font-medium mb-2 block">
                Trimestre
              </label>
              <Select
                value={selectedTrimester}
                onValueChange={setSelectedTrimester}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar trimestre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Primer Trimestre</SelectItem>
                  <SelectItem value="2">Segundo Trimestre</SelectItem>
                  <SelectItem value="3">Tercer Trimestre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estudiantes</p>
                <p className="text-2xl font-bold">{totalStudents}</p>
              </div>
              <Users className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Con notas</p>
                <p className="text-2xl font-bold text-success">
                  {studentsWithGrades}
                </p>
              </div>
              <ClipboardList className="h-8 w-8 text-success/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold text-amber-500">
                  {totalStudents - studentsWithGrades}
                </p>
              </div>
              <BookOpen className="h-8 w-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Promedio</p>
                <p
                  className={`text-2xl font-bold ${getGradeColor(averageTotal)}`}
                >
                  {averageTotal || "-"}
                </p>
              </div>
              <Calculator className="h-8 w-8 text-info/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add SubPunto Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Sub-punto de Evaluación</DialogTitle>
            <DialogDescription>
              Este sub-punto se agregará a todos los estudiantes de este curso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dimension">Dimensión</Label>
              <Select
                value={newSubPunto.dimension}
                onValueChange={(value) =>
                  setNewSubPunto({ ...newSubPunto, dimension: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ser">Ser (10%)</SelectItem>
                  <SelectItem value="saber">Saber (45%)</SelectItem>
                  <SelectItem value="hacer">Hacer (40%)</SelectItem>
                  <SelectItem value="autoevaluacion">
                    Autoevaluación (5%)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del sub-punto</Label>
              <Input
                id="nombre"
                placeholder="Ej: Examen Parcial 3, Tarea 5, etc."
                value={newSubPunto.nombre}
                onChange={(e) =>
                  setNewSubPunto({ ...newSubPunto, nombre: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                handleAddSubPunto(
                  newSubPunto.dimension as keyof StudentGrade["dimensiones"],
                )
              }
            >
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grades Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>3ro Primaria A - Matemáticas</CardTitle>
              <CardDescription>Primer Trimestre - Gestión 2025</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setIsDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Agregar Sub-punto
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {studentsWithTotal.map((student) => (
              <Collapsible
                key={student.id}
                open={expandedStudent === student.id}
                onOpenChange={() =>
                  setExpandedStudent(
                    expandedStudent === student.id ? null : student.id,
                  )
                }
              >
                <div className="rounded-lg border">
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      {expandedStudent === student.id ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="text-left">
                        <p className="font-medium">{student.name}</p>
                        <p className="text-xs text-muted-foreground">
                          CI: {student.ci}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex gap-4 text-sm">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground cursor-help">
                                Ser:{" "}
                                <span
                                  className={getGradeColor(
                                    student.dimensiones.ser.promedio,
                                  )}
                                >
                                  {student.dimensiones.ser.promedio ?? "-"}
                                </span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>10% del total</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground cursor-help">
                                Saber:{" "}
                                <span
                                  className={getGradeColor(
                                    student.dimensiones.saber.promedio,
                                  )}
                                >
                                  {student.dimensiones.saber.promedio ?? "-"}
                                </span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>45% del total</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground cursor-help">
                                Hacer:{" "}
                                <span
                                  className={getGradeColor(
                                    student.dimensiones.hacer.promedio,
                                  )}
                                >
                                  {student.dimensiones.hacer.promedio ?? "-"}
                                </span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>40% del total</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground cursor-help">
                                Auto:{" "}
                                <span
                                  className={getGradeColor(
                                    student.dimensiones.autoevaluacion.promedio,
                                  )}
                                >
                                  {student.dimensiones.autoevaluacion
                                    .promedio ?? "-"}
                                </span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>5% del total</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xl font-bold ${getGradeColor(student.total)}`}
                        >
                          {student.total ?? "-"}
                        </span>
                        <Badge variant={getGradeBadge(student.total).variant}>
                          {getGradeBadge(student.total).label}
                        </Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t p-4 bg-muted/30">
                      <Tabs defaultValue="ser" className="w-full">
                        <TabsList className="w-full justify-start">
                          <TabsTrigger value="ser">Ser (10%)</TabsTrigger>
                          <TabsTrigger value="saber">Saber (45%)</TabsTrigger>
                          <TabsTrigger value="hacer">Hacer (40%)</TabsTrigger>
                          <TabsTrigger value="autoevaluacion">
                            Auto (5%)
                          </TabsTrigger>
                        </TabsList>
                        {(
                          Object.keys(student.dimensiones) as Array<
                            keyof typeof student.dimensiones
                          >
                        ).map((dim) => (
                          <TabsContent key={dim} value={dim} className="mt-4">
                            <div className="rounded-md border bg-background">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Sub-punto</TableHead>
                                    <TableHead className="w-[120px] text-center">
                                      Nota (0-100)
                                    </TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {student.dimensiones[dim].subPuntos.length ===
                                  0 ? (
                                    <TableRow>
                                      <TableCell
                                        colSpan={3}
                                        className="text-center text-muted-foreground py-8"
                                      >
                                        No hay sub-puntos definidos.
                                        <br />
                                        <Button
                                          variant="link"
                                          size="sm"
                                          onClick={() => {
                                            setNewSubPunto({
                                              nombre: "",
                                              dimension: dim,
                                            });
                                            setIsDialogOpen(true);
                                          }}
                                        >
                                          Agregar uno
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    student.dimensiones[dim].subPuntos.map(
                                      (subPunto) => (
                                        <TableRow key={subPunto.id}>
                                          <TableCell className="font-medium">
                                            {subPunto.nombre}
                                          </TableCell>
                                          <TableCell>
                                            <Input
                                              type="number"
                                              min="0"
                                              max="100"
                                              className="w-20 mx-auto text-center"
                                              value={subPunto.nota ?? ""}
                                              onChange={(e) =>
                                                handleGradeChange(
                                                  student.id,
                                                  dim,
                                                  subPunto.id,
                                                  e.target.value,
                                                )
                                              }
                                              placeholder="-"
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 text-destructive hover:text-destructive"
                                              onClick={() =>
                                                handleRemoveSubPunto(
                                                  dim,
                                                  subPunto.id,
                                                )
                                              }
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      ),
                                    )
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                            <div className="flex justify-between items-center mt-4 px-2">
                              <span className="text-sm text-muted-foreground">
                                Promedio de {student.dimensiones[dim].nombre}:
                              </span>
                              <span
                                className={`text-lg font-bold ${getGradeColor(
                                  student.dimensiones[dim].promedio,
                                )}`}
                              >
                                {student.dimensiones[dim].promedio ??
                                  "Sin calificar"}
                              </span>
                            </div>
                          </TabsContent>
                        ))}
                      </Tabs>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
