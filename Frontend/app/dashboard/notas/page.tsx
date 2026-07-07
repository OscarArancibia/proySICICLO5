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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Save,
  FileText,
  BookOpen,
  Users,
  ClipboardList,
  Calculator,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StudentGrade {
  id: number;
  name: string;
  ser: number | null;
  saber: number | null;
  hacer: number | null;
  autoevaluacion: number | null;
  total: number | null;
}

const students: StudentGrade[] = [
  {
    id: 1,
    name: "María García López",
    ser: 85,
    saber: 78,
    hacer: 82,
    autoevaluacion: 90,
    total: null,
  },
  {
    id: 2,
    name: "Juan Pérez Mamani",
    ser: 90,
    saber: 85,
    hacer: 88,
    autoevaluacion: 95,
    total: null,
  },
  {
    id: 3,
    name: "Sofía Rodríguez Quispe",
    ser: 75,
    saber: 70,
    hacer: 72,
    autoevaluacion: 80,
    total: null,
  },
  {
    id: 4,
    name: "Carlos Mendoza Flores",
    ser: null,
    saber: null,
    hacer: null,
    autoevaluacion: null,
    total: null,
  },
  {
    id: 5,
    name: "Ana Martínez Choque",
    ser: 95,
    saber: 92,
    hacer: 90,
    autoevaluacion: 100,
    total: null,
  },
];

// Calcula el promedio ponderado según el sistema boliviano
function calculateTotal(grade: StudentGrade): number | null {
  if (
    grade.ser === null ||
    grade.saber === null ||
    grade.hacer === null ||
    grade.autoevaluacion === null
  ) {
    return null;
  }
  // Ser: 10%, Saber: 45%, Hacer: 40%, Autoevaluación: 5%
  return Math.round(
    grade.ser * 0.1 +
      grade.saber * 0.45 +
      grade.hacer * 0.4 +
      grade.autoevaluacion * 0.05,
  );
}

function getGradeColor(grade: number | null): string {
  if (grade === null) return "text-muted-foreground";
  if (grade >= 90) return "text-success";
  if (grade >= 70) return "text-primary";
  if (grade >= 51) return "text-warning-foreground";
  return "text-destructive";
}

export default function NotasPage() {
  const [selectedGrade, setSelectedGrade] = useState("3A");
  const [selectedSubject, setSelectedSubject] = useState("matematicas");
  const [selectedTrimester, setSelectedTrimester] = useState("1");

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Registro de Calificaciones
          </h1>
          <p className="text-muted-foreground">
            Sistema de evaluación boliviano (Ser, Saber, Hacer, Autoevaluación)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Generar Reporte
          </Button>
          <Button className="gap-2">
            <Save className="h-4 w-4" />
            Guardar Cambios
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
                <strong>Ser (10%):</strong> Actitud y valores |{" "}
                <strong>Saber (45%):</strong> Conocimientos teóricos |{" "}
                <strong>Hacer (40%):</strong> Aplicación práctica |{" "}
                <strong>Autoevaluación (5%):</strong> Reflexión del estudiante
              </p>
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
                <p className="text-2xl font-bold text-warning-foreground">
                  {totalStudents - studentsWithGrades}
                </p>
              </div>
              <BookOpen className="h-8 w-8 text-warning/50" />
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
                  {averageTotal}
                </p>
              </div>
              <Calculator className="h-8 w-8 text-info/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grades Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>3ro Primaria A - Matemáticas</CardTitle>
              <CardDescription>Primer Trimestre - Gestión 2025</CardDescription>
            </div>
            <Badge variant="outline">
              {studentsWithGrades}/{totalStudents} completos
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {studentsWithTotal.map((student) => (
              <div key={student.id} className="rounded-lg border p-4 space-y-2">
                <p className="font-medium">{student.name}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={student.ser ?? ""}
                    placeholder="Ser"
                  />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={student.saber ?? ""}
                    placeholder="Saber"
                  />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={student.hacer ?? ""}
                    placeholder="Hacer"
                  />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={student.autoevaluacion ?? ""}
                    placeholder="Auto"
                  />
                </div>
                <p className={`font-bold ${getGradeColor(student.total)}`}>
                  Total: {student.total ?? "-"}
                </p>
              </div>
            ))}
          </div>
          <div className="hidden md:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Estudiante</TableHead>
                  <TableHead className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 justify-center w-full">
                          Ser (10%)
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Actitudes, valores y convivencia
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 justify-center w-full">
                          Saber (45%)
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Conocimientos teóricos y cognitivos
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 justify-center w-full">
                          Hacer (40%)
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Aplicación práctica y habilidades
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 justify-center w-full">
                          Auto (5%)
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Autoevaluación del estudiante
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-center">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentsWithTotal.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {student.name}
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        className="w-16 mx-auto text-center"
                        defaultValue={student.ser ?? ""}
                        placeholder="-"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        className="w-16 mx-auto text-center"
                        defaultValue={student.saber ?? ""}
                        placeholder="-"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        className="w-16 mx-auto text-center"
                        defaultValue={student.hacer ?? ""}
                        placeholder="-"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        className="w-16 mx-auto text-center"
                        defaultValue={student.autoevaluacion ?? ""}
                        placeholder="-"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`font-bold text-lg ${getGradeColor(student.total)}`}
                      >
                        {student.total ?? "-"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
