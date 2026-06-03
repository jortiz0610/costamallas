// Departamentos y ciudades principales de Colombia
// Mapea ciudad -> departamento para autocompletar

export const DEPARTAMENTOS: string[] = [
  "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bolívar", "Boyacá", "Caldas",
  "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca",
  "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena", "Meta", "Nariño",
  "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés y Providencia",
  "Santander", "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada",
];

// Ciudades principales por departamento
export const CIUDADES_POR_DEPARTAMENTO: Record<string, string[]> = {
  "Amazonas": ["Leticia", "Puerto Nariño"],
  "Antioquia": ["Medellín", "Bello", "Itagüí", "Envigado", "Apartadó", "Rionegro", "Sabaneta", "Turbo", "Caucasia", "La Estrella", "Copacabana", "Caldas"],
  "Arauca": ["Arauca", "Saravena", "Tame"],
  "Atlántico": ["Barranquilla", "Soledad", "Malambo", "Sabanalarga", "Puerto Colombia", "Galapa"],
  "Bolívar": ["Cartagena", "Magangué", "Turbaco", "Arjona", "El Carmen de Bolívar"],
  "Boyacá": ["Tunja", "Duitama", "Sogamoso", "Chiquinquirá", "Paipa"],
  "Caldas": ["Manizales", "La Dorada", "Chinchiná", "Villamaría", "Riosucio"],
  "Caquetá": ["Florencia", "San Vicente del Caguán"],
  "Casanare": ["Yopal", "Aguazul", "Villanueva"],
  "Cauca": ["Popayán", "Santander de Quilichao", "Puerto Tejada", "Patía"],
  "Cesar": ["Valledupar", "Aguachica", "Agustín Codazzi", "Bosconia"],
  "Chocó": ["Quibdó", "Istmina", "Tadó"],
  "Córdoba": ["Montería", "Cereté", "Lorica", "Sahagún", "Montelíbano", "Tierralta"],
  "Cundinamarca": ["Bogotá", "Soacha", "Facatativá", "Zipaquirá", "Chía", "Fusagasugá", "Girardot", "Mosquera", "Madrid", "Funza", "Cajicá", "Cota", "Tocancipá", "La Calera"],
  "Guainía": ["Inírida"],
  "Guaviare": ["San José del Guaviare"],
  "Huila": ["Neiva", "Pitalito", "Garzón", "La Plata"],
  "La Guajira": ["Riohacha", "Maicao", "Uribia", "Fonseca", "San Juan del Cesar"],
  "Magdalena": ["Santa Marta", "Ciénaga", "Fundación", "El Banco"],
  "Meta": ["Villavicencio", "Acacías", "Granada", "Puerto López"],
  "Nariño": ["Pasto", "Tumaco", "Ipiales", "Túquerres"],
  "Norte de Santander": ["Cúcuta", "Ocaña", "Pamplona", "Villa del Rosario", "Los Patios"],
  "Putumayo": ["Mocoa", "Puerto Asís", "Orito"],
  "Quindío": ["Armenia", "Calarcá", "La Tebaida", "Montenegro", "Quimbaya"],
  "Risaralda": ["Pereira", "Dosquebradas", "Santa Rosa de Cabal", "La Virginia"],
  "San Andrés y Providencia": ["San Andrés", "Providencia"],
  "Santander": ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta", "Barrancabermeja", "San Gil"],
  "Sucre": ["Sincelejo", "Corozal", "Sampués", "San Marcos"],
  "Tolima": ["Ibagué", "Espinal", "Melgar", "Honda", "Líbano", "Mariquita"],
  "Valle del Cauca": ["Cali", "Buenaventura", "Palmira", "Tuluá", "Cartago", "Buga", "Jamundí", "Yumbo", "Florida", "Candelaria", "Zarzal"],
  "Vaupés": ["Mitú"],
  "Vichada": ["Puerto Carreño"],
};

// Lista plana de ciudades, ordenada
export const CIUDADES: string[] = Array.from(
  new Set(Object.values(CIUDADES_POR_DEPARTAMENTO).flat())
).sort((a, b) => a.localeCompare(b, "es"));

// Mapa ciudad -> departamento
export const CIUDAD_A_DEPARTAMENTO: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [depto, ciudades] of Object.entries(CIUDADES_POR_DEPARTAMENTO)) {
    for (const c of ciudades) map[c] = depto;
  }
  return map;
})();

export function departamentoDeCiudad(ciudad: string): string | undefined {
  return CIUDAD_A_DEPARTAMENTO[ciudad];
}
