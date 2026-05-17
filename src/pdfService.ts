import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Genera un reporte PDF con una tabla de datos.
 */
export const exportToPDF = (data: any[], title: string, filename: string) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 14, 20);
  
  (doc as any).autoTable({
    startY: 30,
    head: [Object.keys(data[0])],
    body: data.map(obj => Object.values(obj)),
    headStyles: { fillColor: [36, 21, 122] }, // Color #24157A
  });
  
  doc.save(`${filename}.pdf`);
};