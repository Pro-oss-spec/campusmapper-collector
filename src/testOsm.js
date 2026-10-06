import { fetchOsmRoads } from './lib/osmRoads'

async function test() {
  try {
    console.log('Fetching OpenStreetMap roads...')

    const roads = await fetchOsmRoads({
      // Temporary public-campus test area:
      // University of Nigeria, Nsukka
      south: 6.84,
      west: 7.37,
      north: 6.88,
      east: 7.42,
    })

    console.log('OSM roads found:', roads.length)

    roads.slice(0, 10).forEach((road, index) => {
      console.log(
        `${index + 1}. ${road.name} (${road.highway})`,
        road.geometry
      )
    })
  } catch (error) {
    console.error('OSM test failed:', error)
  }
}

test()