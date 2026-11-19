// One place to map photos to page sections.
// To swap a photo later: drop the new file into src/assets/photos/ and change the import below.
// `pos` is the CSS object-position used to crop the photo inside its frame.
import car from "../assets/photos/station-car.webp";
import row from "../assets/photos/station-row.webp";
import dusk from "../assets/photos/station-dusk.webp";

export const photos = {
    hero: { src: car, pos: "30% 50%", alt: "Electric SUV plugged into a fast charger on a tree-lined city street" },
    about: { src: row, pos: "60% 50%", alt: "A row of fast chargers beside a parking lot" },
    how: { src: dusk, pos: "50% 50%", alt: "Cars charging under a canopy at a fast-charging station at dusk" },
    driver: { src: car, pos: "20% 50%", alt: "EV driver’s view: an electric SUV connected to a charger" },
    operator: { src: row, pos: "80% 50%", alt: "Charging station with several chargers ready for use" },
    stats: { src: dusk, pos: "50% 50%", alt: "" },
    cta: { src: row, pos: "50% 60%", alt: "" },
};
