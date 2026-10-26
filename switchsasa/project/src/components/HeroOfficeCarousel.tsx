import { useEffect, useState } from 'react';

const officePhotos = [
  '/assets/images/image_20261024_091053.jpg',
  '/assets/images/image_20261024_090827.jpg',
  '/assets/images/image_20261024_090821.jpg',
  '/assets/images/image_20261024_090823.jpg',
  '/assets/images/image_20261024_090816.jpg',
];

export default function HeroOfficeCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setActive((current) => (current + 1) % officePhotos.length), 4200);
    return () => window.clearInterval(timer);
  }, []);

  return <div className="hero-office-carousel" aria-label="Switch Microfinance offices">
    {officePhotos.map((photo, index) => <img key={photo} className={index === active ? 'active' : ''} src={photo} alt="Switch Microfinance office" />)}
    <div className="hero-carousel-dots">{officePhotos.map((photo, index) => <button key={photo} className={index === active ? 'active' : ''} onClick={() => setActive(index)} aria-label={`Show office photo ${index + 1}`} />)}</div>
  </div>;
}
