'use client';
import { useParams } from 'next/navigation';
import { sections } from '@/data/TeamData';

export default function TeamMemberPage() {
  const params = useParams();
  const memberName = params.member;

  const member = sections
    .flatMap(section => section.members)
    .find(m => m.name.replace(/\s+/g, '-').toLowerCase() === memberName);

  if (!member) return <p className="text-white p-8">Member not found</p>;

  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 flex flex-col items-center p-8">
      <img src={member.image} alt={member.name} className="w-40 h-40 rounded-full mb-6" />
      <h1 className="text-4xl font-bold text-white mb-4">{member.name}</h1>
      <h2 className="text-xl text-white/80 mb-6">{member.role}</h2>
      <p className="text-white max-w-xl text-center">{member.story}</p>
    </div>
  );
}
