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
      <section className="mt-15 w-full max-w-3xl text-center">
        <h2 className="text-3xl font-semibold mb-6">Event Location</h2>
        <p className="text-gray-100 mb-2">Shobnall Leisure Complex, Burton upon Trent</p>
        <div className="relative w-full h-80 sm:h-96 mb-8">
          <Image
            src="/image/PrideEventMaps.png"
            alt="Event Location Map"
            layout="fill"
            objectFit="contain"
            className="rounded-lg cursor-pointer"
            onClick={() => openModal('/image/PrideEventMaps.png')}
          />
        </div>
      </section>

      {/* Modal for Full Image View */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50"
          onClick={closeModal}
        >
          <div className="relative">
            <Image
              src={selectedImage}
              alt="Full Screen Event Map"
              width={800}
              height={600}
              objectFit="contain"
              className="rounded-lg"
            />
            <button
              className="absolute top-0 right-0 p-4 text-white bg-black rounded-full"
              onClick={closeModal}
            >
              X
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default EventMapWithModal;
