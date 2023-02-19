import React, { useState, useEffect, useCallback } from "react";

import { read,  write, utils , WorkBook , WorkSheet , utils as XLSXUtils , writeFileXLSX } from "xlsx";


import { auth, firestore, storage } from "./firebase";
import firebase from "./firebase";



function App() {


  const [file, setFile] = useState(null);

  const [fileName, setFileName] = useState("");

  const [fileType, setFileType] = useState("");

  const [fileSize, setFileSize] = useState(0);

  const [fileData, setFileData] = useState([]);


  

  const [positiveWords, setPositiveWords] = useState([]);
  const [negativeWords, setNegativeWords] = useState([])

  

  


  useEffect(() => {
    const fileData = localStorage.getItem('fileData');
    if(fileData) {
      setFileData(JSON.parse(fileData));
    }
  }, []);
  

  useEffect(() => {
    const getPositiveWords = async () => {
      const positiveWords = await firestore.collection("annotations").doc("positiveWords").get();
      setPositiveWords(positiveWords.data().positiveWords);
    };
    getPositiveWords();
  }, []);

  useEffect(() => {
    const getNegativeWords = async () => {
      const negativeWords = await firestore.collection("annotations").doc("negativeWords").get();
      setNegativeWords(negativeWords.data().negativeWords);
    };
    getNegativeWords();
  }, []);

  useEffect(() => {
    // remove the world which is present in both positive and negative words and also remove the duplicate words also update the database
    (async () => {
        let positiveWords = await firestore.collection("annotations").doc("positiveWords").get();
        let negativeWords = await firestore.collection("annotations").doc("negativeWords").get();

        let positiveWordsArray = positiveWords.data().positiveWords;
        let negativeWordsArray = negativeWords.data().negativeWords;

        let positiveWordsArrayUpdated = positiveWordsArray.filter((item) => !negativeWordsArray.includes(item));
        let negativeWordsArrayUpdated = negativeWordsArray.filter((item) => !positiveWordsArray.includes(item));

        positiveWordsArrayUpdated.map((item, index) => item.trim());
        negativeWordsArrayUpdated.map((item, index) => item.trim());

        positiveWordsArrayUpdated = positiveWordsArrayUpdated.filter((item) => item !== "");
        negativeWordsArrayUpdated = negativeWordsArrayUpdated.filter((item) => item !== "");

        positiveWordsArrayUpdated = [...new Set(positiveWordsArrayUpdated)];
        negativeWordsArrayUpdated = [...new Set(negativeWordsArrayUpdated)];



        await firestore.collection("annotations").doc("positiveWords").update({
          positiveWords: positiveWordsArrayUpdated
        });

        await firestore.collection("annotations").doc("negativeWords").update({
          negativeWords: negativeWordsArrayUpdated
        });
    })();

  }, []);
  


  const handleFile = (e) => {
      
      const file = e.target.files[0];
  
      setFile(file);
  
      setFileName(file.name);
  
      setFileType(file.type);

      setFileSize(file.size);

  
    };


  const handleFileRead = (e) => {
        
        const content = e.target.result;
    
        const workbook = read(content, { type: "binary" });
    
        const sheetName = workbook.SheetNames[0];
    
        const worksheet = workbook.Sheets[sheetName];
    
        const data = utils.sheet_to_json(worksheet);

        data.map((item, index) => {
          let banglaText = item.Comments;
          banglaText = banglaText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g," ");
         

          if(banglaText) {
            let banglaWords = banglaText.split(" ");
            banglaWords = banglaWords.filter((item) => item !== "");
            banglaWords = banglaWords.map((item) => item.trim());
            banglaWords =  banglaWords.join(",");
            /// check any sub string of banglaWords is present in positiveWords or negativeWords

            let positiveWordsFound = positiveWords.filter((item) => banglaWords.includes(item));
            let negativeWordsFound = negativeWords.filter((item) => banglaWords.includes(item));


            if(positiveWordsFound.length > negativeWordsFound.length && positiveWordsFound.length > 0) {
              item.data_label = "1";
            } else if(negativeWordsFound.length > positiveWordsFound.length && negativeWordsFound.length > 0) {
              item.data_label = "0";
            }
            else if(positiveWordsFound.length > 0) {
              item.data_label = "1";
            } else if(negativeWordsFound.length > 0) {
              item.data_label = "0";
            } else {
              item.data_label = "2";
            }

            
          }
        });

    
        setFileData(JSON.parse(JSON.stringify(data)));

        localStorage.setItem('fileData', JSON.stringify(data));

    
      };


  const handleFileChosen = (file) => {
          
      const reader = new FileReader();
  
      reader.onloadend = handleFileRead;
  
      reader.readAsBinaryString(file);

  
    };


  const handleFileUpload = () => {
            
        if (file) {
          handleFileChosen(file);
        }

      }


   const handleFileDownload = () => {

        let data = fileData.map((item, index) => {
          item.data_label = item.data_label ? JSON.parse(item.data_label) : "2";
          item.Comments = item.Comments.replace(/(\r\n|\n|\r)/gm, "");
          return item;
        });

        const ws = XLSXUtils.json_to_sheet(data);
        const wb = XLSXUtils.book_new();
        XLSXUtils.book_append_sheet(wb, ws, "SheetJS");
        writeFileXLSX(wb, "SheetJS.xlsx");
      };

    const onSelectionChange = (e, index) => {
      let { checked } = e.target;
      let newData = [...fileData];
      console.log(newData, 'newData');
      newData[index].data_label = checked ? e.target.value : "";
      setFileData(newData);
      localStorage.setItem('fileData', JSON.stringify(newData));
    };



    const Feedback = () => {

      const [showPositive, setShowPositive] = useState(false);
      const [showNegitive, setShowNegitive] = useState(false);
      const [positiveInput, setPositiveInput] = useState("");
      const [negativeInput, setNegativeInput] = useState("");

      const [loading, setLoading] = useState(false);


      const handlePositiveSubmit = async () => {
        if(positiveInput === "" || positiveInput === " ") {
          return;
        }
       setLoading(true);
       let textArray = positiveInput.split(" ");
        textArray = textArray.filter((item) => item !== "");
        textArray = textArray.map((item) => item.trim());
        textArray = textArray.join(",");
        console.log(textArray, 'textArray');
        await firestore.collection("annotations").doc("positiveWords").set({
          positiveWords: firebase.firestore.FieldValue.arrayUnion(textArray),
        }, { merge: true });
        setLoading(false);
        setPositiveInput("");
        setShowPositive(false);
      };

      const handleNegativeSubmit = async () => {
        if(negativeInput === "" || negativeInput === " ") {
          return;
        }
        setLoading(true);
        let textArray = negativeInput.split(" ");
        textArray = textArray.filter((item) => item !== "");
        textArray = textArray.map((item) => item.trim());
        textArray = textArray.join(",");
        await firestore.collection("annotations").doc("negativeWords").set({
          negativeWords: firebase.firestore.FieldValue.arrayUnion(textArray),
        }, { merge: true });
        setLoading(false);
        setNegativeInput("");
        setShowNegitive(false);
      };

      return (
              <>
                {showPositive && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "10px" }}>
                        <textarea value={positiveInput} onChange={(e) => setPositiveInput(e.target.value)} style={{ width: "80%", height: "40px" }} />
                        <button onClick={handlePositiveSubmit} style={{height: "40px", width: "20%", marginLeft: '5px' }}>Add Positive Words</button>
                    </div>
          )}
          {showNegitive && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "10px" }}>
              <textarea value={negativeInput} onChange={(e) => setNegativeInput(e.target.value)} style={{ width: "80%", height: "40px" }} />
              <button onClick={handleNegativeSubmit} style={{height: "40px", width: "20%", marginLeft: '5px' }}>Add Negative Words</button>
            </div>
          )}
          <div style={{ marginTop: "10px", marginBottom: "10px", display: "flex", alignItems: "end", justifyContent: "end" }}>
              <button onClick={() => setShowPositive(!showPositive)}
              style={{ marginRight: "10px" }}
              disabled={loading}
              >Add Positive</button>
              <button onClick={() => setShowNegitive(!showNegitive)}
              style={{ marginRight: "10px" }}
              disabled={loading}
              >Add Negative</button>
          </div>
          
        </>
      );
    };


    const TableList = () => {
      return (
        <table>
        <thead>
          <tr style={{ backgroundColor: "#f2f2f2" }}>
            <th style={{ padding: "10px 0" , width: "10%" }}>__rowNum__</th>
            <th style={{ padding: "10px 0" , width: "70%" }}>Comments</th>
            <th style={{ padding: "10px 0" , width: "10%" }}>data_label</th>
            <th style={{ padding: "10px 0" , width: "10%" }}>data_label</th>
          </tr>
        </thead>
        <tbody>
          {fileData.map((item, index) => (
            <tr key={index} style={{ 
              backgroundColor: index % 2 === 0 ? "#f2f2f2" : "#fff",
              border: "1px solid #ddd"
             }}>
              <td style={{ padding: "10px", width: "10%", textAlign: "center" }}>{index + 1}</td>
              <td style={{ padding: "10px", width: "70%" }}>{item?.Comments}
               <div style={{  marginTop: "10px" }}>
                 <Feedback  />
               </div>

              </td>
              <td style={{ padding: "10px", width: "10%", textAlign: "center" }}>{item?.data_label}</td>
              <td>
                <input type="checkbox" value="0" checked={item?.data_label === "0"} style={{  marginLeft: "10px" }} onChange={(e) => onSelectionChange(e, index)} />
                <input type="checkbox" value="1" checked={item?.data_label === "1"} style={{  marginLeft: "10px" }} onChange={(e) => onSelectionChange(e, index)} />
                <input type="checkbox" value="2" checked={item?.data_label === "2"} style={{  marginLeft: "10px" }} onChange={(e) => onSelectionChange(e, index)} />
                
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      );
    };



  return (
    <div style={{ margin: "0 auto", width: "80%" }}>
      <h3>Upload and Download Excel File</h3>
      <p>Upload and Download Excel File using React and XLSX</p>
      <p>File Name : {fileName}</p>
      <p>File Size : {fileSize}</p>
      <p>File Type : {fileType}</p>
      <input type="file" onChange={handleFile} />
      <button onClick={handleFileUpload} style={{ margin: "0 10px", padding: "10px 20px" }}>Upload</button>
      <button onClick={handleFileDownload} style={{ margin: "0 10px", padding: "10px 20px"  }}>Download</button>
      <button onClick={() => {localStorage.clear(); setFileData([])}} style={{ margin: "0 10px", padding: "10px 20px", marginBottom : '5px'  }}>Clear</button>
      <p style={{ marginTop: "10px" }}>Add Positive and Negative Words.</p>
      <p style={{ fontWeight: 'bold'}}> NB: if you add a word both positive and negative then it will be removed from both automatically.</p>
      {fileData.length > 0 && <TableList />}
    </div>
  );
}

export default App;

            

