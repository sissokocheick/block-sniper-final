import logo from './assets/logo.png';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Toaster, toast } from 'react-hot-toast';
import { contractAddress, contractABI } from './contractInfo'; 
import './index.css';

// Import des améliorations
import { motion, AnimatePresence } from 'framer-motion';
import useSound from 'use-sound';
import winSfx from './sounds/win.mp3';
import missSfx from './sounds/miss.mp3';

const POLLING_INTERVAL = 200;
const READ_ONLY_RPC_URL = "https://dream-rpc.somnia.network/";

const readProvider = new ethers.JsonRpcProvider(READ_ONLY_RPC_URL);
const readOnlyContract = new ethers.Contract(contractAddress, contractABI, readProvider);

function App() {
  // State
  const [provider, setProvider] = useState(null); // Gère la connexion MetaMask
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState("0");
  const [blockNumber, setBlockNumber] = useState(null);
  const [bonusPools, setBonusPools] = useState({ hard: "0", normal: "0", easy: "0" });
  const [targetBlock, setTargetBlock] = useState('');
  const [currentFee, setCurrentFee] = useState(0);
  const [windowSize, setWindowSize] = useState(1);
  const [isMining, setIsMining] = useState(false);
  const [playerStats, setPlayerStats] = useState({ wagered: "0", won: "0" });
  const [username, setUsername] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userHistory, setUserHistory] = useState([]);
  const [lastResult, setLastResult] = useState(() => JSON.parse(localStorage.getItem('lastResult')) || null);
  const [gameEvents, setGameEvents] = useState(() => JSON.parse(localStorage.getItem('gameEvents')) || []);
  const [hallOfFame, setHallOfFame] = useState(() => JSON.parse(localStorage.getItem('hallOfFame')) || { winnerAddress: null, winnerUsername: "", prize: "0", bettorAddress: null, bettorUsername: "", wagered: "0" });
  
  const [playWinSound] = useSound(winSfx);
  const [playMissSound] = useSound(missSfx);
  
  useEffect(() => { localStorage.setItem('lastResult', JSON.stringify(lastResult)); }, [lastResult]);
  useEffect(() => { localStorage.setItem('gameEvents', JSON.stringify(gameEvents)); }, [gameEvents]);
  
  // --- MODIFIED & ROBUST connectWallet ---
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const metaMaskProvider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await metaMaskProvider.send("eth_requestAccounts", []);
        
        if (accounts.length > 0) {
          const connectedAccount = accounts[0];
          const web3Signer = await metaMaskProvider.getSigner();
          
          // Fetch all user data immediately on connect
          const userBalance = await readProvider.getBalance(connectedAccount);
          const fetchedUsername = await readOnlyContract.usernames(connectedAccount);
          const stats = await readOnlyContract.getPlayerStats(connectedAccount);

          // Set all states
          setSigner(web3Signer);
          setBalance(ethers.formatEther(userBalance));
          setUsername(fetchedUsername);
          setPlayerStats({
            wagered: ethers.formatEther(stats.wagered),
            won: ethers.formatEther(stats.won)
          });
          setAccount(connectedAccount); // Set account last to trigger other effects
        }
      } catch (error) { toast.error("Failed to connect wallet."); }
    } else { toast.error("Please install MetaMask."); }
  };

  // Disconnect wallet function
  const disconnectWallet = () => {
    setProvider(null); 
    setAccount(null);
    setSigner(null);
    setBalance("0");
    setUsername("");
    setPlayerStats({ wagered: "0", won: "0" });
    setIsProfileOpen(false);
  };

  // Function to fetch GLOBAL recent activity
  const fetchRecentActivity = async () => {
    try {
      const latestBlock = await readProvider.getBlockNumber();
      const fromBlock = latestBlock - 999;
      const successFilter = readOnlyContract.filters.SnipeSuccess();
      const missFilter = readOnlyContract.filters.SnipeMiss();
      const successEvents = await readOnlyContract.queryFilter(successFilter, fromBlock, latestBlock);
      const missEvents = await readOnlyContract.queryFilter(missFilter, fromBlock, latestBlock);
      const allEvents = [...successEvents, ...missEvents]
        .sort((a, b) => b.blockNumber - a.blockNumber)
        .slice(0, 5)
        .map(event => {
          if (event.eventName === 'SnipeSuccess') {
            return `🎉 ${event.args.winner.substring(0, 6)}... won ${ethers.formatEther(event.args.prize)} STT!`;
          } else {
            return `🙁 ${event.args.player.substring(0, 6)}... missed block ${event.args.startBlock}.`;
          }
        });
      if (allEvents.length > 0) setGameEvents(allEvents);
    } catch (error) { console.error("Could not fetch recent activity:", error); }
  };

  // Function to fetch user-specific history
  const fetchUserHistory = async () => {
    if (!account) return;
    try {
      const latestBlock = await readProvider.getBlockNumber();
      const fromBlock = latestBlock - 999;
      const successFilter = readOnlyContract.filters.SnipeSuccess(account);
      const missFilter = readOnlyContract.filters.SnipeMiss(account);
      const successEvents = await readOnlyContract.queryFilter(successFilter, fromBlock, latestBlock);
      const missEvents = await readOnlyContract.queryFilter(missFilter, fromBlock, latestBlock);
      const allUserEvents = [...successEvents, ...missEvents]
        .sort((a, b) => b.blockNumber - a.blockNumber)
        .slice(0, 10)
        .map(event => {
          if (event.eventName === 'SnipeSuccess') {
            return `✅ Won ${ethers.formatEther(event.args.prize)} STT on block #${event.args.blockHit}`;
          } else {
            return `❌ Missed block #${event.args.startBlock}`;
          }
        });
      setUserHistory(allUserEvents);
    } catch (error) { console.error("Could not fetch user history:", error); }
  };

  useEffect(() => {
    const updateGlobalData = async () => {
      try {
        const block = await readProvider.getBlockNumber();
        setBlockNumber(block);
        const bonusData = await readOnlyContract.getBonusPools();
        setBonusPools({
          hard: ethers.formatEther(bonusData.hard),
          normal: ethers.formatEther(bonusData.normal),
          easy: ethers.formatEther(bonusData.easy)
        });
        const winnerAddress = await readOnlyContract.biggestWinner();
        const prizeAmount = await readOnlyContract.biggestPrize();
        const bettorAddress = await readOnlyContract.biggestBettor();
        const wageredAmount = await readOnlyContract.biggestTotalWagered();
        setHallOfFame({
          winnerAddress: prizeAmount > 0 ? winnerAddress : null,
          winnerUsername: prizeAmount > 0 ? await readOnlyContract.usernames(winnerAddress) : "",
          prize: ethers.formatEther(prizeAmount),
          bettorAddress: wageredAmount > 0 ? bettorAddress : null,
          bettorUsername: wageredAmount > 0 ? await readOnlyContract.usernames(bettorAddress) : "",
          wagered: ethers.formatEther(wageredAmount)
        });
      } catch (error) { console.error("Error fetching global game data:", error); }
    };

    updateGlobalData();
    fetchRecentActivity();
    const interval = setInterval(() => {
      updateGlobalData();
      fetchRecentActivity();
    }, POLLING_INTERVAL);
    
    return () => clearInterval(interval);
  }, []); // Empty array `[]` means this runs once on mount and keeps running

  // useEffect pour les données spécifiques à l'utilisateur (s'exécute à la connexion)
  useEffect(() => {
    const updateUserData = async () => {
      if (account && provider) { // Ne s'exécute que si on est connecté
        try {
          const stats = await readOnlyContract.getPlayerStats(account);
          setPlayerStats({
            wagered: ethers.formatEther(stats.wagered),
            won: ethers.formatEther(stats.won)
          });

          const fetchedUsername = await readOnlyContract.usernames(account);
          setUsername(fetchedUsername);

          const userBalance = await provider.getBalance(account);
          setBalance(ethers.formatEther(userBalance));
        } catch (error) { console.error("Error fetching user data:", error); }
      }
    };
    updateUserData();
  }, [account, provider]); // Se relance à chaque fois que `account` ou `provider` change

  // Dynamic Fee Calculation
  useEffect(() => {
    const updateDynamicFee = async () => {
      if (!targetBlock) return;
      try {
        const fee = await readOnlyContract.getCurrentEntryFee(targetBlock);
        setCurrentFee(fee);
      } catch (e) { console.error("Could not fetch fee", e); }
    };
    const debounce = setTimeout(updateDynamicFee, 300);
    return () => clearTimeout(debounce);
  }, [targetBlock]);

  // Auto-hide Last Result
  useEffect(() => {
    if (!lastResult) return;
    const timer = setTimeout(() => setLastResult(null), 10000);
    return () => clearTimeout(timer);
  }, [lastResult]);
  
  // On-Demand Block Fetch
  const fetchLatestBlock = async () => {
    try {
      const block = await readProvider.getBlockNumber();
      setBlockNumber(block);
      toast('Block number updated!');
    } catch (error) { console.error("Failed to fetch latest block:", error); }
  };

  // Set Username Function
  const handleSetUsername = async () => {
    if (!signer || !newUsername) return toast.error("Please enter a username.");
    toast.loading('Saving username...', { id: 'setUsernameTx' });
    try {
      const contractWithSigner = new ethers.Contract(contractAddress, contractABI, signer);
      const tx = await contractWithSigner.setUsername(newUsername);
      await tx.wait();
      setUsername(newUsername);
      setNewUsername("");
      toast.success('Username saved!', { id: 'setUsernameTx' });
    } catch (e) {
      toast.error('Failed to save username.', { id: 'setUsernameTx' });
    }
  };

  // Main Play Function
  const handlePlay = async () => {
    if (!signer || !targetBlock) return toast.error("Please connect wallet and select a target.");
    if (parseInt(targetBlock) <= blockNumber) return toast.error("Target is already in the past!");
    
    setIsMining(true);
    setLastResult(null);
    toast.loading('Sending transaction...', { id: 'playTx' });
    
    try {
      const contractWithSigner = new ethers.Contract(contractAddress, contractABI, signer);
      const tx = await contractWithSigner.play(targetBlock, windowSize, { value: currentFee });
      const receipt = await tx.wait();
      
      let prizeWon = "0";
      const isWin = receipt.logs.some(log => {
          try {
              const parsedLog = contractWithSigner.interface.parseLog(log);
              if (parsedLog?.name === "SnipeSuccess") {
                prizeWon = ethers.formatEther(parsedLog.args.prize);
                return true;
              }
              return false;
          } catch (e) { return false; }
      });

      setLastResult({ target: targetBlock, actual: receipt.blockNumber, win: isWin });

      const explorerUrl = "https://shannon-explorer.somnia.network";
      if (isWin) {
        playWinSound();
        toast.success(
          (t) => (
            <span>
              Congratulations! You won {parseFloat(prizeWon).toFixed(4)} STT!
              <a href={`${explorerUrl}/tx/${receipt.hash}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: '#646cff', marginLeft: '10px' }}>
                View Tx
              </a>
            </span>
          ), { id: 'playTx', duration: 8000 }
        );
      } else {
        playMissSound();
        toast.error(
          (t) => (
            <span>
                Missed! Your transaction was in block #{receipt.blockNumber}
                <a href={`${explorerUrl}/tx/${receipt.hash}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: '#646cff', marginLeft: '10px' }}>
                    View Tx
                </a>
            </span>
          ), { id: 'playTx', duration: 8000 }
        );
      }
    } catch (e) {
      console.error(e);
      toast.error("Transaction failed.", { id: 'playTx' });
    }
    setTargetBlock('');
    setIsMining(false);
  };

  const formattedFee = ethers.formatUnits(currentFee, 18);

  return (
    <div className="App">
      <Toaster position="top-center" reverseOrder={false} />
      <header className="App-header">
<div className="logo-container">
  <img src={logo} alt="BlockSniper Logo" className="app-logo" />
  <h1>BlockSniper</h1>
  <span className="version-tag">Beta</span>
</div>        {account ? (
          <div className="connect-button" onClick={() => {
              fetchUserHistory();
              setIsProfileOpen(true);
            }}>
            <strong>{username || `${account.substring(0, 6)}...`}</strong> | Balance: {parseFloat(balance).toFixed(2)} STT
          </div>
        ) : (
          <button onClick={connectWallet} className="connect-button">Connect Wallet</button>
        )}
      </header>
      
      {account && (
        <>
          <main className="dashboard">
            <h2>CURRENT BLOCK</h2>
            <div className="block-number">{blockNumber ? blockNumber.toLocaleString() : 'Connecting...'}</div>
            <small style={{ color: '#888' }}>Updated every {POLLING_INTERVAL / 1000} seconds</small>
          </main>
          
          <div className="hall-of-fame">
            <h3>🏆 Hall of Fame 🏆</h3>
            {hallOfFame.winnerAddress ? (
              <p><strong>Biggest Win:</strong> {parseFloat(hallOfFame.prize).toFixed(4)} STT by {hallOfFame.winnerUsername || `${hallOfFame.winnerAddress.substring(0, 6)}...`}</p>
            ) : (<p>No win record set yet.</p>)}
            {hallOfFame.bettorAddress ? (
              <p><strong>Biggest Bettor:</strong> {parseFloat(hallOfFame.wagered).toFixed(4)} STT wagered by {hallOfFame.bettorUsername || `${hallOfFame.bettorAddress.substring(0, 6)}...`}</p>
            ) : (<p>No betting record set yet.</p>)}
          </div>

          <AnimatePresence>
            {lastResult && (
              <motion.div
                className="result-display"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
              >
                <h3>Last Result</h3>
                <p>You targeted: <strong>#{lastResult.target}</strong> | Your Tx was in: <strong>#{lastResult.actual}</strong></p>
                <p>Outcome: {lastResult.win ? <strong style={{color: 'lightgreen'}}>🎉 YOU WON!</strong> : <strong style={{color: 'salmon'}}>🙁 You missed.</strong>}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="difficulty-selector">
            <span>Difficulty:</span>
            <button onClick={() => { setWindowSize(1); fetchLatestBlock(); }} className={windowSize === 1 ? 'active' : ''}>
              Hard (1 Block) <br/> <strong>+ {parseFloat(bonusPools.hard).toFixed(2)} STT</strong>
            </button>
            <button onClick={() => { setWindowSize(5); fetchLatestBlock(); }} className={windowSize === 5 ? 'active' : ''}>
              Normal (5 Blocks) <br/> <strong>+ {parseFloat(bonusPools.normal).toFixed(2)} STT</strong>
            </button>
            <button onClick={() => { setWindowSize(10); fetchLatestBlock(); }} className={windowSize === 10 ? 'active' : ''}>
              Easy (10 Blocks) <br/> <strong>+ {parseFloat(bonusPools.easy).toFixed(2)} STT</strong>
            </button>
          </div>

          <div className="quick-targets">
            <span>Quick Targets:</span>
            <button onClick={() => setTargetBlock(blockNumber + 10)}>+10</button>
            <button onClick={() => setTargetBlock(blockNumber + 20)}>+20</button>
            <button onClick={() => setTargetBlock(blockNumber + 50)}>+50</button>
          </div>

          <div className="action-panel">
            <input 
              type="number" 
              className="target-input"
              placeholder="Enter block or use quick targets"
              value={targetBlock}
              onChange={(e) => setTargetBlock(e.target.value)}
              disabled={isMining}
            />
            {targetBlock && <p className="entry-fee">Cost for this block: {formattedFee} STT</p>}
            <button onClick={handlePlay} className="play-button" disabled={isMining || !targetBlock}>
              {isMining ? 'Transaction Pending...' : '🎯 SNIPE BLOCK !'}
            </button>
          </div>
          
          <div className="game-info">
            <div className="player-stats">
              <h3>My Stats</h3>
              <p>Total Wagered: <strong>{parseFloat(playerStats.wagered).toFixed(4)} STT</strong></p>
              <p>Total Won: <strong>{parseFloat(playerStats.won).toFixed(4)} STT</strong></p>
            </div>
            <div className="activity-feed">
              <h3>Recent Activity</h3>
              {gameEvents.length > 0 ? (
                <ul>{gameEvents.map((event, index) => (<li key={index}>{event}</li>))}</ul>
              ) : (<p>No activity yet.</p>)}
            </div>
          </div>
        </>
      )}

      {isProfileOpen && (
        <div className="profile-modal-overlay">
          <div className="profile-modal">
            <button className="close-button" onClick={() => setIsProfileOpen(false)}>X</button>
            <h2>My Profile</h2>
            <div className="profile-info">
              <p><strong>Username:</strong> {username || "Not Set"}</p>
              <p><strong>Address:</strong> {`${account.substring(0, 6)}...${account.substring(account.length - 4)}`}</p>
              <p><strong>Balance:</strong> {parseFloat(balance).toFixed(4)} STT</p>
              <p>
                <strong>Game Contract:</strong>
                <a 
                  href={`https://shannon-explorer.somnia.network/address/${contractAddress}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'underline', color: '#646cff', marginLeft: '10px' }}
                >
                  View on Explorer
                </a>
              </p>
            </div>
            <div className="username-form" style={{ marginTop: '1rem' }}>
              <input type="text" placeholder="New username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
              <button onClick={handleSetUsername}>Save</button>
            </div>
            <h3>My Game History</h3>
            <div className="profile-history">
              {userHistory.length > 0 ? (
                <ul>
                  {userHistory.map((action, index) => (
                    <li key={index}>{action}</li>
                  ))}
                </ul>
              ) : (
                <p>No actions recorded.</p>
              )}
            </div>
            <button className="disconnect-button" onClick={disconnectWallet}>
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
