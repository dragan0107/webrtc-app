const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const signalingServer = new WebSocket('ws://webrtc-app-myya.onrender.com');  // Connect to the WebSocket server
let localStream;
let peerConnection;

// STUN server for NAT traversal
const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

async function start() {
  try {
    // Get local media stream (video + audio)
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    // Initialize RTCPeerConnection
    peerConnection = new RTCPeerConnection(configuration);

    // Add local stream to the peer connection
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Set up event handlers for the peer connection
    peerConnection.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];  // Display the remote video
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        signalingServer.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
      }
    };

    signalingServer.onmessage = async (message) => {
      const data = await message.data.text();  // Convert Blob to text
    
      try {
        const parsedData = JSON.parse(data);  // Parse the text as JSON
    
        if (parsedData.type === 'offer') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(parsedData.offer));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          signalingServer.send(JSON.stringify({ type: 'answer', answer: answer }));
        } else if (parsedData.type === 'answer') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(parsedData.answer));
        } else if (parsedData.type === 'candidate') {
          if (parsedData.candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(parsedData.candidate));
          }
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    // Create and send an offer if no connection is already established
    if (peerConnection.signalingState === 'stable') {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      signalingServer.send(JSON.stringify({ type: 'offer', offer: offer }));
    }

  } catch (error) {
    console.error('Error accessing media devices.', error);
  }
}

// Start the process
start();
