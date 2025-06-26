'use client';

import { useState } from 'react';
import Image from 'next/image';

const EventMapWithModal = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');

  const openModal = (imageSrc: string) => {
    setSelectedImage(imageSrc);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      {/* Map Image Section */}
      <section className="mt-15 w-full max-w-3xl text-center mx-auto">
        <h2 className="text-3xl font-semibold mb-6">Event Location</h2>
        <p className="text-gray-100 mb-2">Shobnall Leisure Complex, Burton upon Trent</p>
        <div className="relative w-full h-80 sm:h-96 mb-8 cursor-pointer mx-auto max-w-full" style={{ maxWidth: '600px' }}>
          <Image
            src="/image/PrideEventMaps.png"
            alt="Event Location Map"
            layout="fill"
            objectFit="contain"
            className="rounded-lg"
            onClick={() => openModal('/image/PrideEventMaps.png')}
          />
        </div>
      </section>

      {/* Modal for Full Image View */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="relative max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside modal content
          >
            <Image
              src={selectedImage}
              alt="Full Screen Event Map"
              width={800}
              height={600}
              objectFit="contain"
              className="rounded-lg"
            />
            <button
              className="absolute top-2 right-2 p-2 text-white bg-black bg-opacity-70 rounded-full hover:bg-opacity-90 transition"
              onClick={closeModal}
              aria-label="Close modal"
              type="button"
            >
              &#x2715; {/* Unicode × */}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default EventMapWithModal;
