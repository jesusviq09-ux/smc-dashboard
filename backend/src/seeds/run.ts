import { Vehicle, TrainingLocation, Circuit } from '../models/index'

export async function seedDatabase(): Promise<void> {
  await seedVehicles()
  await seedLocations()
  await seedCircuits()
}

async function seedVehicles() {
  const count = await Vehicle.count()
  if (count > 0) return

  await Vehicle.bulkCreate([
    {
      id: 'smc01',
      name: 'SMC 01',
      material: 'Acero',
      weightKg: 80,
      restrictions: [],
      description: 'Vehículo convencional de acero. Apto para todos los circuitos y pilotos.',
      status: 'operational',
      totalHours: 0,
      totalKm: 0,
    },
    {
      id: 'smc02',
      name: 'SMC 02 EVO',
      material: 'Aluminio',
      weightKg: 40,
      restrictions: ['karting_rivas'],
      description: 'Vehículo de competición en aluminio. Mayor velocidad y eficiencia. No apto para Karting de Rivas.',
      status: 'operational',
      totalHours: 0,
      totalKm: 0,
    },
  ])
  console.log('[Seed] Vehicles created')
}

async function seedLocations() {
  const count = await TrainingLocation.count()
  if (count > 0) return

  await TrainingLocation.bulkCreate([
    {
      id: 'karting_rivas',
      name: 'Karting de Rivas',
      scheduleStart: '09:30',
      scheduleEnd: '16:30',
      allowedVehicleIds: ['smc01'],
      circuitType: 'Karting cerrado',
      description: 'Circuito de karting de Rivas-Vaciamadrid. Solo SMC 01 (el SMC 02 EVO no gira suficiente).',
    },
    {
      id: 'smc_development',
      name: 'Circuito de Desarrollo SMC',
      allowedVehicleIds: ['smc01', 'smc02'],
      circuitType: 'Superficie asfaltada amplia',
      description: 'Circuito propio del equipo. Sin restricción de horario. Apto para ambos vehículos.',
    },
  ])
  console.log('[Seed] Training locations created')
}

async function seedCircuits() {
  const count = await Circuit.count()
  if (count > 0) return

  await Circuit.bulkCreate([
    {
      name: 'Circuito de Desarrollo SMC',
      city: 'Madrid',
      country: 'España',
      lengthMeters: 500,
      asphaltType: 'Asfalto liso',
      elevationMeters: 5,
      numberOfCurves: 6,
      sectors: [],
      notes: 'Circuito propio del equipo SMC. Superficie amplia asfaltada.',
      restrictions: [],
    },
    {
      name: 'Karting de Rivas',
      city: 'Rivas-Vaciamadrid',
      country: 'España',
      lengthMeters: 800,
      asphaltType: 'Asfalto de karting',
      numberOfCurves: 12,
      sectors: [],
      notes: 'Circuito de karting. Solo SMC 01. Horario 9:30-16:30.',
      restrictions: ['smc02'],
    },
  ])
  console.log('[Seed] Circuits created')
}
