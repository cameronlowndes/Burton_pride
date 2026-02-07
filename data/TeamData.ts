// /data/teamData.ts

export interface Member {
  name: string;
  image: string;
  role: string;
  storyTitle?: string; // Optional
  story?: string;
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
        story: `For me, being part of Burton Pride is about creating understanding, hope, and long-lasting change, not just planning events. 
                Being a part of something that unites people, dismantles barriers, and serves as a constant reminder to our community that love and respect know no bounds makes me proud.
                The effort is rewarded by every smile, every thank-you note, and every person who says they at last feel heard. For this reason, I'm still dedicated to this endeavour and to making Burton a more accepting and inclusive place for everyone.
                I witnessed for many years how neurodiverse people and members of the LGBTIQA+ community frequently felt alone, invisible, or uncertain of their place in the world. I was aware that Burton-on-Trent had the capacity to become a community that celebrates diversity rather than merely tolerating it. I wanted to help create environments where people of diverse origins, families, and young people can feel free to be who they are.`
      },
      {
        name: 'Isaac Timmins',
        image: '/image/PeoplePicturePng/isaac.png',
        role: 'Founder & Director | He/Him',
        story: `I am Isaac, I’m in my late 20s now but have always been a bit odd battling both physical and mental disabilities I have never been what society deems as “Normal”
            I am bi so the LGBTIA+ community is very close to my heart. So after attending many prides across the country me and Simon decided why can’t our home town have one. It’s a tremendous source of hard work but it is rewarding to be there to support the community. 

I want more integration than just queuing in the supermarket. I moved to Burton after uni as it is a great midlands town where we have a rich heritage and I want to support an organization that helps the town and the people.`

      },
      {
        name: 'Olga Niewiadomska',
        image: '/image/PeoplePicturePng/Olga.png',
        role: 'Director | She/Her',
        storyTitle: 'Why I Joined Burton Pride',
        story: `As an ally, I believe it is more important than ever to stand shoulder-to-shoulder with the LGBTQIA+ community. We are currently living through difficult and uncertain times, where the hard-won rights and safety of LGBTQIA+ individuals are frequently challenged. In a climate where rhetoric can often feel divisive, I wanted to turn my support into tangible action.
​                 Burton Pride is more than just a celebration; it is a vital space for visibility, protest, and belonging. ​I am honoured to play a small part in ensuring that Pride remains a beacon of hope and a platform for authentic self-expression in our local area.`
      },
      {
        name: 'Cameron Lowndes',
        image: '/image/PeoplePicturePng/cameron.png',
        role: 'Board Member | He/Him/His/They',
        storyTitle: 'Why I Joined Burton Pride',
        story: `I joined Burton Pride because I deeply believe in the power of community. Pride is not just a celebration; it’s about connection, support, and belonging. 
                For me, Pride should always be community-first, not company-first. I want to help build something that reflects the people it serves, a place where everyone feels seen, included, and valued.
                As someone who has been active in politics with the Green Party, I’ve always wanted to give back in a way that makes a real difference. Burton Pride gives me that chance. It’s a way to invest my time, my skills, and my energy into something bigger than myself into a community that deserves to be celebrated and supported every day. Giving back isn’t just about helping others—it’s about strengthening the connections that make our town and our people stronger, kinder, and more united.
                Every day I dedicate myself to building and strengthening this community. From managing our social media to developing the website and coordinating the main event, every task I take on is done with the people in mind. My commitment is simple: everything I do within Burton Pride is for the community, and for making sure that everyone who participates feels a sense of pride and belonging.
                Being part of Burton Pride isn’t just volunteering—it’s being part of something bigger than myself. I promise that as long as I’m involved, the community will remain my guiding force. My efforts, my energy, and my dedication will always be focused on giving back, creating an inclusive environment, and helping build a Pride that truly belongs to everyone.`
      },
      {
        name: 'Citrine Stone',
        image: '/image/PeoplePicturePng/citrine.png',
        role: 'Board Member | they/them',
        // story: 'Need To BE ADDED' // TODO
      },
      {
        name: 'Jazz',
        image: '/image/PeoplePicturePng/Jazz.jpeg',
        role: 'Board Member | they/them/he',
        storyTitle: 'Why I Joined Burton Pride',
        story: `Hey there, I’m Jazz, a Poly, pan, non-binary, queer artist currently based in Burton. I am the owner of GothFrog Art and I have been 
                involved with various Queer rights protests and pride for 25+ years. I came out to my dad when I was 13 years old as queer, and then I came out as non-binary in 2010.
                I have joined Burton Pride for a few reasons mostly to be in the background helping with trading and making sure everything is accessible for those of us who are Neurodivergent, as well as physical and mental health disabilities, but also because I want people to remember that pride is not just a party!
                It's not just a get together, but it is a protest that showcases our right to exist. Especially at a time when trans folks are facing so much persecution from so many different directions.
                I just wanna remind people that we have the right to exist and we're not going anywhere no matter how much people try to push us down!
                At the same time I also just wanted to help out with the organising. I have a lot of experience in conventions, volunteer work, and being in the background keeping things running smoothly. I wanted to help get the awareness out there that there is a Burton Pride and kind of make it fun whilst making sure we’re keeping the protest going. For as long as everyone under the LGBTQIA+ umbrella are being targeted, persecuted, and bullied, people like myself will be here reminding everyone that we are human beings, just trying to live our lives, and we have that right!`
      }
    ]
  }
];
