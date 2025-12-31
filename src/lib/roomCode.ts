function slugifyName(name: string) {
    return (
      name
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 12) || "ROOM"
    );
  }
  
  function randomDigits() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
  
  export function makeRoomCode(roomName: string) {
    return `${slugifyName(roomName)}-${randomDigits()}`;
  }
  