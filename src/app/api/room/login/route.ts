import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyPassword } from "@/lib/passwords";
import { setSession } from "@/lib/session";

type Body = {
  roomCode: string;
  joinPassword: string;
  username: string;
  password: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  const roomCode = (body.roomCode || "").trim();
  const joinPassword = (body.joinPassword || "").trim();
  const username = (body.username || "").trim().toLowerCase();
  const password = (body.password || "").trim();

  if (!roomCode) return NextResponse.json({ error: "roomCode is required" }, { status: 400 });
  if (!joinPassword) return NextResponse.json({ error: "Join password is required" }, { status: 400 });
  if (!username) return NextResponse.json({ error: "Notandanafn er krafist" }, { status: 400 });
  if (!password) return NextResponse.json({ error: "Lykilorð er krafist" }, { status: 400 });

  // Sækja room með join_password_hash
  const { data: room, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id, room_code, join_password_hash")
    .ilike("room_code", roomCode)
    .single();

  if (rErr || !room) return NextResponse.json({ error: "Deild fannst ekki" }, { status: 404 });

  // Athuga join password
  const joinOk = await verifyPassword(room.join_password_hash, joinPassword);
  if (!joinOk) return NextResponse.json({ error: "Wrong join password" }, { status: 401 });

  // Sækja member með username
  const { data: member, error: mErr } = await supabaseServer
    .from("room_members")
    .select("id, password_hash, is_owner")
    .eq("room_id", room.id)
    .ilike("username", username)
    .single();

  if (mErr || !member) {
    // Athuga hvort notandi sé í annarri deild með sama username og password
    const { data: otherRoomMembers } = await supabaseServer
      .from("room_members")
      .select("id, room_id, password_hash, is_owner")
      .ilike("username", username);
    
    if (otherRoomMembers && otherRoomMembers.length > 0) {
      // Prófa að finna notanda með sama password í annarri deild
      for (const otherMember of otherRoomMembers) {
        const passwordOk = await verifyPassword(otherMember.password_hash, password);
        if (passwordOk) {
          // Sækja display_name úr annarri deildinni
          const { data: otherMemberFull } = await supabaseServer
            .from("room_members")
            .select("display_name")
            .eq("id", otherMember.id)
            .single();
          
          // Notandi er í annarri deild með sama username og password
          // Búa til nýjan member í nýju deildinni með sama username, password og display_name
          const { data: newMember, error: newMemberErr } = await supabaseServer
            .from("room_members")
            .insert({
              room_id: room.id,
              username,
              password_hash: otherMember.password_hash, // Nota sama password hash
              display_name: otherMemberFull?.display_name || username, // Nota sama display_name
              is_owner: false,
            })
            .select("id")
            .single();
          
          if (newMemberErr || !newMember) {
            // Ef unique constraint error, þá er notandi þegar í þessari deild
            if (newMemberErr?.code === "23505" || newMemberErr?.message?.includes("unique")) {
              // Notandi er þegar í þessari deild, skrá hann inn
              const { data: existingMember } = await supabaseServer
                .from("room_members")
                .select("id, password_hash, is_owner")
                .eq("room_id", room.id)
                .ilike("username", username)
                .single();
              
              if (existingMember) {
                await setSession({
                  roomId: room.id,
                  memberId: existingMember.id,
                  roomCode: room.room_code,
                  role: existingMember.is_owner ? "owner" : "player",
                });
                return NextResponse.json({ ok: true, roomCode: room.room_code });
              }
            }
            return NextResponse.json({ 
              error: "Ekki tókst að joina deild. Notaðu 'Nýr aðgangur' til að búa til nýjan aðgang í þessari deild." 
            }, { status: 500 });
          }
          
          // Nýr member búinn til, skrá hann inn
          await setSession({
            roomId: room.id,
            memberId: newMember.id,
            roomCode: room.room_code,
            role: "player",
          });
          return NextResponse.json({ ok: true, roomCode: room.room_code, autoJoined: true });
        }
      }
      
      // Notandi er í annarri deild en password er ekki rétt
      return NextResponse.json({ 
        error: "Notandanafn er ekki í þessari deild. Notaðu 'Nýr aðgangur' til að joina þessari deild." 
      }, { status: 401 });
    }
    return NextResponse.json({ error: "Rangt notandanafn eða lykilorð" }, { status: 401 });
  }

  // Athuga password
  const ok = await verifyPassword(member.password_hash, password);
  if (!ok) return NextResponse.json({ error: "Rangt notandanafn eða lykilorð" }, { status: 401 });

  await setSession({
    roomId: room.id,
    memberId: member.id,
    roomCode: room.room_code,
    role: member.is_owner ? "owner" : "player",
  });

  return NextResponse.json({ ok: true, roomCode: room.room_code });
}

