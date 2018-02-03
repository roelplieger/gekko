cd /home/roel/gekko_roel

cp xrptrade.log t1_xrp.txt


diff=$(diff t1_xrp.txt t2_xrp.txt | grep -E 'BUY|SELL|PROFIT|price|rsi' | sed ':a;N;$!ba;s/\n/\\n/g' | sed 's/< //g' | sed 's/\t\t //g' | sed 's/\t/\\t/g' | sed 's/(INFO)://g' | sed 's/(DEBUG)://g')
json="{ \"value1\": \"\\nXRP:\\n"$diff"\" }"

#echo "$json"

if [ ! -z "$diff" ]
then curl -d "$json" -H "Content-Type: application/json" -X POST https://maker.ifttt.com/trigger/gekko_trade/with/key/crGyrAaBfn-9QlmvVvDx_w
fi

cp t1_xrp.txt t2_xrp.txt


