// /data/teamData.ts
export interface Member {
  name: string;
  image: string;
  role: string;
  storyTitle?: string;   // ✅ ADD THIS
  story: string;
}


export interface Section {
  title: string;
  members: Member[];
}

export const sections: Section[] = [
  {
    title: 'Committed Board',
    members: [
      {
        name: 'Simon Whale',
        image: '/image/PeoplePicturePng/simon.png',
        role: 'Founder & Organizer | He/Him',
        storyTitle: 'Why I Joined Burton Pride', 
        story: ` For me, being part of Burton Pride is about creating understanding, hope, and long-lasting change, not just planning events. Being a part of something that unites people, dismantles barriers, and serves as a constant reminder to our community that love and respect know no bounds makes me proud. 

The effort is rewarded by every smile, every thank-you note, and every person who says they at last feel heard. For this reason, I'm still dedicated to this endeavour and to making Burton a more accepting and inclusive place for everyone.

I witnessed for many years how neurodiverse people and members of the LGBTQ+ community frequently felt alone, invisible, or uncertain of their place in the world. I was aware that Burton-on-Trent had the capacity to become a community that celebrates diversity rather than merely tolerating it. I wanted to help create environments where people of diverse origins, families, and young people can feel free to be who they are.`
      },
      {
        name: 'Isaac Timmins',
        image: '/image/PeoplePicturePng/isaac.png',
        role: 'Founder & Director | He/Him',
        story: 'Need To BE ADDED'
      },
      {
        name: 'Olga Niewiadomska',
        image: '/image/PeoplePicturePng/Olga.png',
        role: 'Director | She/Her',
        story: 'Need To BE ADDED'
      },
      {
        name: 'Cameron Lowndes',
        image: '/image/PeoplePicturePng/cameron.png',
        role: 'Board Member | He/Him/His/They',
        storyTitle: 'Why I Joined Burton Pride', 
        story: `

I joined Burton Pride because I deeply believe in the power of community. Pride is not just a celebration it’s about connection, support, and belonging. For me, Pride should always be community-first, not company-first. I want to help build something that reflects the people it serves, a place where everyone feels seen, included, and valued.

As someone who has been active in politics with the Green Party, I’ve always wanted to give back in a way that makes a real difference. Burton Pride gives me that chance. It’s a way to invest my time, my skills, and my energy into something bigger than myself into a community that deserves to be celebrated and supported every day. Giving back isn’t just about helping others it’s about strengthening the connections that make our town and our people stronger, kinder, and more united.

Every day I dedicate myself to building and strengthening this community. From managing our social media to developing the website and coordinating the main event, every task I take on is done with the people in mind. My commitment is simple: everything I do within Burton Pride is for the community, and for making sure that everyone who participates feels a sense of pride and belonging.

Being part of Burton Pride isn’t just volunteering it’s being part of something bigger than myself. I promise that as long as I’m involved, the community will remain my guiding force. My efforts, my energy, and my dedication will always be focused on giving back, creating an inclusive environment, and helping build a Pride that truly belongs to everyone.`
      },
      {
        name: 'Citrine Stone',
        image: '/image/PeoplePicturePng/citrine.png',
        role: 'Board Member | they/them',
        story: 'Need To BE ADDED'
      }
    ]
  }
];
